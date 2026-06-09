import { getStore } from '@netlify/blobs'
import Stripe from 'stripe'
import type {
  ApiResponse,
  CreateEventCheckoutRequest,
  CreateEventRequest,
  EventApiRequest,
  EventDetails,
  EventRecord,
  EventStatus,
  EventVisibility,
  Gift,
  Guest,
  PlannerState,
  PublicEventRecord,
  Reservation,
  ReservationStatus,
  Rsvp,
} from '../../src/types'

const STORE_NAME = 'planner-events'
const CURRENT_VERSION = 1
const MAX_GIFTS = 40
const MAX_GUESTS = 120
const MAX_RSVPS = 120
const MAX_RESERVATIONS = 120

/** Jednorazowa opłata za utworzenie wydarzenia (PLN → grosze). */
const EVENT_CREATE_AMOUNT_GROSZE = 500

/** Po ilu dniach od daty imprezy wydarzenie jest archiwizowane, a kontakty czyszczone (RODO). */
const ARCHIVE_AFTER_DAYS = 30

class ApiError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message)
  }
}

const storage = {
  async read(id: string) {
    const store = getStore(STORE_NAME)
    const record = await store.get(getStoreKey(id), {
      consistency: 'strong',
      type: 'json',
    })

    return record ? normalizeRecord(record as Partial<EventRecord>) : null
  },

  /** Odczyt z etagiem — podstawa warunkowych zapisow (ochrona przed nadpisaniem rownoleglych zmian). */
  async readWithEtag(id: string): Promise<{ record: EventRecord; etag?: string } | null> {
    const store = getStore(STORE_NAME)
    const result = await store.getWithMetadata(getStoreKey(id), {
      consistency: 'strong',
      type: 'json',
    })

    if (!result) return null
    return {
      record: normalizeRecord(result.data as Partial<EventRecord>),
      etag: result.etag,
    }
  },

  async write(record: EventRecord, actor: string) {
    const store = getStore(STORE_NAME)
    const nextRecord: EventRecord = {
      ...record,
      version: (record.version || 0) + 1,
      lastUpdatedBy: actor,
      updatedAt: new Date().toISOString(),
    }

    await store.setJSON(getStoreKey(record.id), nextRecord)
    return nextRecord
  },

  /**
   * Zapis warunkowy: powiedzie sie tylko, gdy rekord nie zmienil sie od odczytu (etag).
   * Zwraca zapisany rekord albo null przy konflikcie (wtedy caller ponawia odczyt+mutacje).
   * Brak etagu (np. lokalna emulacja Blobs) => zapis bezwarunkowy.
   */
  async writeConditional(record: EventRecord, actor: string, etag?: string) {
    const store = getStore(STORE_NAME)
    const nextRecord: EventRecord = {
      ...record,
      version: (record.version || 0) + 1,
      lastUpdatedBy: actor,
      updatedAt: new Date().toISOString(),
    }

    const result = await store.setJSON(
      getStoreKey(record.id),
      nextRecord,
      etag ? { onlyIfMatch: etag } : undefined,
    )

    return result.modified ? nextRecord : null
  },
}

const UPDATE_RETRY_ATTEMPTS = 3

/**
 * Bezpieczna aktualizacja wydarzenia: odczyt z etagiem -> mutacja -> zapis warunkowy,
 * z ponowieniem przy konflikcie. `apply` mutuje swiezy rekord i zwraca aktora zapisu;
 * walidacje wewnatrz `apply` wykonuja sie na aktualnym stanie przy kazdej probie.
 */
async function updateEventWithRetry(
  id: string | undefined,
  apply: (record: EventRecord) => string,
): Promise<EventRecord> {
  if (!id) throw new ApiError('Brakuje identyfikatora wydarzenia.', 400)

  for (let attempt = 0; attempt < UPDATE_RETRY_ATTEMPTS; attempt += 1) {
    const found = await storage.readWithEtag(id)
    if (!found) throw new ApiError('Nie znaleziono wydarzenia.', 404)

    const record = maybeArchiveExpiredEvent(found.record)
    const actor = apply(record)

    const saved = await storage.writeConditional(record, actor, found.etag)
    if (saved) return saved
  }

  throw new ApiError('Wiele osob zapisuje zmiany jednoczesnie. Sprobuj ponownie za chwile.', 409)
}

function json(data: ApiResponse, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...init?.headers,
    },
  })
}

function createId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`
}

function createEventSlug(childName?: string) {
  const normalized = (childName || 'event')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24)

  return `${normalized || 'event'}-${crypto.randomUUID().slice(0, 8)}`
}

function getStoreKey(id: string) {
  return `events/${id}`
}

function getOrigin(req: Request) {
  return new URL(req.url).origin
}

let stripeSingleton: Stripe | null = null

function getStripe(): Stripe {
  if (!stripeSingleton) {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) {
      throw new ApiError('Platnosci nie sa skonfigurowane (STRIPE_SECRET_KEY).', 503)
    }
    stripeSingleton = new Stripe(key)
  }
  return stripeSingleton
}

function getPublicSiteBaseUrl(req: Request): string {
  const fromEnv = (process.env.URL || process.env.DEPLOY_PRIME_URL || '').trim()
  if (fromEnv) return fromEnv.replace(/\/$/, '')

  const referer = req.headers.get('referer') || req.headers.get('origin') || ''
  if (referer) {
    try {
      return new URL(referer).origin
    } catch {
      /* empty */
    }
  }

  throw new ApiError('Brak adresu strony — ustaw zmienna URL na Netlify.', 500)
}

function stripeUsedSessionKey(sessionId: string) {
  return `stripe-checkout-used/${sessionId}`
}

function checkoutDraftKey(draftId: string) {
  return `checkout-drafts/${draftId}`
}

/** Snapshot szkicu wydarzenia zapisywany przed przekierowaniem do Stripe. */
type CheckoutDraft = {
  planner: PlannerState
  organizerName: string
  organizerContact: string
  createdAt: string
}

/** Rekord konsumpcji sesji Stripe; eventId pojawia sie po udanym utworzeniu wydarzenia. */
type CheckoutClaim = {
  claimedAt: string
  eventId?: string
}

/**
 * Atomowo przejmuje sesje Stripe do utworzenia wydarzenia (onlyIfNew).
 * Zwraca true, gdy to zadanie wygralo claim; false, gdy sesja jest juz przejeta.
 */
async function claimStripeCheckoutSession(sessionId: string): Promise<boolean> {
  const store = getStore(STORE_NAME)
  const result = await store.setJSON(
    stripeUsedSessionKey(sessionId),
    { claimedAt: new Date().toISOString() } satisfies CheckoutClaim,
    { onlyIfNew: true },
  )
  return result.modified
}

async function readCheckoutClaim(sessionId: string): Promise<CheckoutClaim | null> {
  const store = getStore(STORE_NAME)
  const claim = (await store.get(stripeUsedSessionKey(sessionId), {
    type: 'json',
    consistency: 'strong',
  })) as CheckoutClaim | null
  return claim ?? null
}

async function finalizeCheckoutClaim(sessionId: string, eventId: string) {
  const store = getStore(STORE_NAME)
  await store.setJSON(stripeUsedSessionKey(sessionId), {
    claimedAt: new Date().toISOString(),
    eventId,
  } satisfies CheckoutClaim)
}

async function releaseCheckoutClaim(sessionId: string) {
  const store = getStore(STORE_NAME)
  await store.delete(stripeUsedSessionKey(sessionId))
}

/** Waliduje, ze sesja Stripe to oplacona platnosc za utworzenie wydarzenia, i zwraca ja do odczytu metadanych. */
async function retrievePaidEventCreateSession(sessionId: string): Promise<Stripe.Checkout.Session> {
  const cleanId = cleanText(sessionId, 200)
  if (!cleanId.startsWith('cs_')) {
    throw new ApiError('Nieprawidlowy identyfikator sesji platnosci.', 400)
  }

  const stripe = getStripe()
  const session = await stripe.checkout.sessions.retrieve(cleanId)

  if (session.mode !== 'payment') {
    throw new ApiError('Nieprawidlowa sesja platnosci.', 400)
  }
  if (session.payment_status !== 'paid') {
    throw new ApiError('Platnosc nie zostala zakonczona.', 402)
  }
  if ((session.metadata?.purpose ?? '') !== 'event_create') {
    throw new ApiError('Platnosc ma inny cel niz utworzenie wydarzenia.', 400)
  }
  const total = session.amount_total ?? 0
  if (total !== EVENT_CREATE_AMOUNT_GROSZE) {
    throw new ApiError('Niezgodna kwota platnosci.', 400)
  }
  const currency = (session.currency ?? '').toLowerCase()
  if (currency !== 'pln') {
    throw new ApiError('Niezgodna waluta platnosci.', 400)
  }

  return session
}

function cleanText(value: unknown, maxLength: number) {
  return String(value ?? '').trim().slice(0, maxLength)
}

function requireText(value: unknown, label: string, maxLength: number) {
  const text = cleanText(value, maxLength)
  if (!text) throw new ApiError(`${label} jest wymagane.`)
  return text
}

function assertNoSpam(spamTrap?: string) {
  if (spamTrap && spamTrap.trim()) {
    throw new ApiError('Nie mozna zapisac formularza.', 400)
  }
}

function validateEventDetails(event: EventDetails): EventDetails {
  return {
    childName: requireText(event.childName, 'Imie dziecka', 80),
    date: requireText(event.date, 'Termin wydarzenia', 80),
    place: requireText(event.place, 'Miejsce wydarzenia', 160),
    theme: cleanText(event.theme, 160),
    notes: cleanText(event.notes, 1200),
    giftClothingSizes: cleanText(event.giftClothingSizes, 600),
    giftColorNotes: cleanText(event.giftColorNotes, 600),
    giftMediaFavorites: cleanText(event.giftMediaFavorites, 600),
    giftWishListNotes: cleanText(event.giftWishListNotes, 1200),
  }
}

export function safeGiftLink(value: unknown): string {
  const text = cleanText(value, 2000)
  if (!text) return ''

  try {
    const url = text.includes('://') ? new URL(text) : new URL(`https://${text}`)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return ''
    return url.href
  } catch {
    return ''
  }
}

export function validateGiftLink(value: unknown): string {
  const text = cleanText(value, 2000)
  if (!text) return ''

  try {
    const url = text.includes('://') ? new URL(text) : new URL(`https://${text}`)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new ApiError('Link musi uzyc adresu http lub https.', 400)
    }
    return url.href
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError('Nieprawidlowy link. Wklej pelny adres oferty ze sklepu.', 400)
  }
}

function validateGift(gift: Omit<Gift, 'id'>): Omit<Gift, 'id'> {
  return {
    title: requireText(gift.title, 'Nazwa prezentu', 120),
    category: requireText(gift.category, 'Kategoria prezentu', 80),
    details: cleanText(gift.details, 700),
    link: validateGiftLink(gift.link),
  }
}

function normalizeGiftFromStorage(raw: Partial<Gift>): Gift {
  return {
    id: raw.id || createId('gift'),
    title: cleanText(raw.title, 120) || 'Prezent',
    category: cleanText(raw.category, 80) || 'Inne',
    details: cleanText(raw.details, 700),
    link: safeGiftLink(raw.link),
  }
}

function validateGuest(guest: Guest): Guest {
  const name = requireText(guest.name, 'Imie goscia', 120)
  const contact = cleanText(guest.contact, 160)
  if (digitsOnly(contact).length < 9) {
    throw new ApiError('Kazdy gosc musi miec numer telefonu (min. 9 cyfr).', 400)
  }

  return {
    id: guest.id || createId('guest'),
    name,
    contact,
  }
}

function normalizedPhoneKey(value: string) {
  const d = digitsOnly(value)
  if (d.length < 9) return d
  let x = d
  if (x.startsWith('48') && x.length >= 11) x = x.slice(2)
  if (x.startsWith('0') && x.length >= 10) x = x.slice(1)
  return x.slice(-9)
}

export function validateGuestList(guestList: Guest[] = []) {
  const drafted = guestList.slice(0, MAX_GUESTS).map((guest) => ({
    id: guest.id || createId('guest'),
    name: cleanText(guest.name, 120),
    contact: cleanText(guest.contact, 160),
  }))

  const complete = drafted.filter((guest) => guest.name && digitsOnly(guest.contact).length >= 9)

  return complete
    .map(validateGuest)
    .filter((guest, index, list) => list.findIndex((item) => normalizedPhoneKey(item.contact) === normalizedPhoneKey(guest.contact)) === index)
}

/** Odczyt z Blobs: bez walidacji telefonu, zeby stare rekordy nadal sie wczytywaly. */
function normalizeGuestListSoft(raw: unknown): Guest[] {
  if (!Array.isArray(raw)) return []

  return raw.slice(0, MAX_GUESTS).map((item) => {
    const g = item as Partial<Guest>
    const idRaw = typeof g.id === 'string' ? cleanText(g.id, 80) : ''
    return {
      id: idRaw || createId('guest'),
      name: cleanText(g.name, 120) || 'Gosc',
      contact: cleanText(g.contact, 160),
    }
  })
}

export function validatePlanner(planner: PlannerState): PlannerState {
  return {
    event: validateEventDetails(planner.event),
    guestList: validateGuestList(planner.guestList),
    gifts: planner.gifts.slice(0, MAX_GIFTS).map((gift) => ({
      ...validateGift(gift),
      id: gift.id || createId('gift'),
    })),
    reservations: [],
    rsvps: [],
  }
}

function validateReservation(record: EventRecord, reservation: Omit<Reservation, 'id' | 'status' | 'createdAt'>) {
  const giftExists = record.planner.gifts.some((gift) => gift.id === reservation.giftId)
  if (!giftExists) throw new ApiError('Wybrany prezent nie istnieje.', 404)

  const giftTaken = record.planner.reservations.some(
    (item) =>
      item.giftId === reservation.giftId &&
      (item.status === 'approved' || item.status === 'bought'),
  )
  if (giftTaken) throw new ApiError('Ten prezent jest juz zarezerwowany.')

  if (record.planner.reservations.length >= MAX_RESERVATIONS) {
    throw new ApiError('Lista rezerwacji jest pelna.')
  }

  const guest = requireListedGuest(record, reservation.guestName, reservation.contact)

  return {
    giftId: reservation.giftId,
    guestName: guest.name,
    contact: guest.contact,
    message: cleanText(reservation.message, 700),
  }
}

function validateRsvp(record: EventRecord, rsvp: Omit<Rsvp, 'id' | 'updatedAt'>): Omit<Rsvp, 'id' | 'updatedAt'> {
  if (!['yes', 'no', 'maybe'].includes(rsvp.status)) {
    throw new ApiError('Nieprawidlowy status obecnosci.')
  }

  const guest = requireListedGuest(record, rsvp.guestName, rsvp.contact)

  return {
    guestName: guest.name,
    contact: guest.contact,
    status: rsvp.status,
    adults: rsvp.status === 'yes' ? clampNumber(rsvp.adults, 0, 12) : 0,
    children: rsvp.status === 'yes' ? clampNumber(rsvp.children, 0, 12) : 0,
    note: cleanText(rsvp.note, 700),
  }
}

function clampNumber(value: unknown, min: number, max: number) {
  const number = Number(value)
  if (!Number.isFinite(number)) return min
  return Math.min(max, Math.max(min, Math.floor(number)))
}

function normalizeLookup(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, '')
}

function digitsOnly(value: string) {
  return value.replace(/\D/g, '')
}

export function phonesEquivalent(a: string, b: string): boolean {
  const da = digitsOnly(a)
  const db = digitsOnly(b)
  if (da.length < 9 || db.length < 9) return false
  if (da === db) return true

  const stripPl = (d: string) => {
    if (d.startsWith('48') && d.length >= 11) return d.slice(2)
    if (d.startsWith('0') && d.length >= 10) return d.slice(1)
    return d
  }

  const sa = stripPl(da)
  const sb = stripPl(db)
  if (sa === sb) return true
  if (sa.length >= 9 && sb.length >= 9 && sa.slice(-9) === sb.slice(-9)) return true

  return false
}

/** To samo co na froncie przy laczeniu odpowiedzi RSVP / rezerwacji (email lub telefon). */
function contactsEquivalent(a: string, b: string): boolean {
  const compactA = normalizeLookup(a)
  const compactB = normalizeLookup(b)
  if (compactA && compactB && compactA === compactB) return true
  return phonesEquivalent(a, b)
}

export function maskPhoneForPublic(raw: string): string {
  const d = digitsOnly(raw)
  if (d.length < 4) return ''
  return `*** *** ${d.slice(-3)}`
}

function requireListedGuest(record: EventRecord, guestName: string, contact: string) {
  const contactClean = cleanText(contact, 160)

  if (!record.planner.guestList.length) {
    return {
      name: requireText(guestName, 'Imie rodzica', 120),
      contact: requireText(contact, 'Kontakt', 160),
    }
  }

  if (digitsOnly(contactClean).length < 9) {
    throw new ApiError('Podaj numer telefonu z listy zaproszonych (min. 9 cyfr).', 400)
  }

  const guest = record.planner.guestList.find((item) => phonesEquivalent(item.contact, contactClean))

  if (!guest) {
    throw new ApiError('Nie znaleziono tego numeru na liscie zaproszonych.', 403)
  }

  return {
    name: guest.name,
    contact: guest.contact?.trim() ? guest.contact.trim() : contactClean,
  }
}

export function normalizeRecord(record: Partial<EventRecord>): EventRecord {
  const now = new Date().toISOString()

  return {
    id: record.id || createEventSlug(record.planner?.event.childName),
    organizerToken: record.organizerToken || crypto.randomUUID(),
    version: record.version || CURRENT_VERSION,
    status: (record.status as EventStatus) || 'active',
    visibility: (record.visibility as EventVisibility) || 'public_link',
    createdBy: record.createdBy || 'legacy-organizer',
    lastUpdatedBy: record.lastUpdatedBy || record.createdBy || 'legacy-organizer',
    planner: {
      event: validateEventDetails(record.planner?.event ?? emptyEvent()),
      guestList: normalizeGuestListSoft(record.planner?.guestList),
      gifts: (record.planner?.gifts ?? []).map((item) =>
        normalizeGiftFromStorage(item as Partial<Gift>),
      ),
      reservations: record.planner?.reservations ?? [],
      rsvps: record.planner?.rsvps ?? [],
    },
    createdAt: record.createdAt || now,
    updatedAt: record.updatedAt || now,
  }
}

function emptyEvent(): EventDetails {
  return {
    childName: 'Wydarzenie',
    date: new Date().toISOString(),
    place: 'Do ustalenia',
    theme: '',
    notes: '',
    giftClothingSizes: '',
    giftColorNotes: '',
    giftMediaFavorites: '',
    giftWishListNotes: '',
  }
}

export function isEventExpired(record: EventRecord, now = new Date()): boolean {
  if (record.status !== 'active') return false

  const eventDate = new Date(record.planner.event.date)
  if (Number.isNaN(eventDate.getTime())) return false

  const archiveAfter = eventDate.getTime() + ARCHIVE_AFTER_DAYS * 24 * 60 * 60 * 1000
  return now.getTime() > archiveAfter
}

/**
 * Lazy archiwizacja: po uplywie ARCHIVE_AFTER_DAYS od daty imprezy wydarzenie przechodzi
 * w status `archived`, a dane kontaktowe gosci sa czyszczone (minimalizacja danych, RODO).
 * Zwraca ten sam obiekt (zmutowany), zeby wpisac sie w istniejacy przeplyw zapisu.
 */
export function maybeArchiveExpiredEvent(record: EventRecord, now = new Date()): EventRecord {
  if (!isEventExpired(record, now)) return record

  record.status = 'archived'
  record.planner.guestList = record.planner.guestList.map((guest) => ({
    ...guest,
    contact: '',
  }))
  record.planner.reservations = record.planner.reservations.map((reservation) => ({
    ...reservation,
    contact: '',
    message: '',
  }))
  record.planner.rsvps = record.planner.rsvps.map((rsvp) => ({
    ...rsvp,
    contact: '',
    note: '',
  }))

  return record
}

export function stripPrivateData(record: EventRecord, req: Request, canManage: boolean): PublicEventRecord {
  const origin = getOrigin(req)
  const publicUrl = `${origin}/event/${record.id}`
  const manageUrl = canManage
    ? `${origin}/manage/${record.id}?token=${record.organizerToken}`
    : undefined

  const planner = canManage
    ? record.planner
    : {
        ...record.planner,
        guestList: record.planner.guestList.map((guest) => ({
          ...guest,
          contact: maskPhoneForPublic(guest.contact),
        })),
        reservations: record.planner.reservations.map((reservation) => ({
          ...reservation,
          contact: '',
          message: '',
        })),
        rsvps: record.planner.rsvps.map((rsvp) => ({
          ...rsvp,
          contact: '',
          note: '',
        })),
      }

  return {
    id: record.id,
    version: record.version,
    status: record.status,
    visibility: record.visibility,
    createdBy: record.createdBy,
    planner,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    canManage,
    publicUrl,
    manageUrl,
  }
}

async function handleGet(req: Request) {
  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  const token = url.searchParams.get('token') ?? undefined

  if (!id) throw new ApiError('Brakuje identyfikatora wydarzenia.')

  const found = await storage.readWithEtag(id)
  if (!found) throw new ApiError('Nie znaleziono wydarzenia.', 404)

  let record = found.record

  if (isEventExpired(record)) {
    record = maybeArchiveExpiredEvent(record)
    // Best-effort utrwalenie archiwizacji; przy konflikcie i tak serwujemy widok zarchiwizowany.
    try {
      await storage.writeConditional(record, 'auto-archive', found.etag)
    } catch (error) {
      console.error('Nie udalo sie zapisac archiwizacji wydarzenia', error)
    }
  }

  return json({
    event: stripPrivateData(record, req, token === record.organizerToken),
  })
}

async function handleCreateEventCheckout(req: Request, body: EventApiRequest) {
  if (body.action !== 'createEventCheckout') throw new ApiError('Nieprawidlowa akcja.')
  assertNoSpam(body.spamTrap)

  const payload = body as CreateEventCheckoutRequest

  // Walidacja PRZED platnoscia — blad danych nie moze wyjsc dopiero po pobraniu 5 zl.
  const organizerName = requireText(payload.organizerName, 'Imie organizatora', 120)
  const organizerContact = requireText(payload.organizerContact, 'Kontakt organizatora', 160)
  const planner = validatePlanner(payload.planner)

  // Snapshot szkicu na serwerze: powrot z platnosci nie zalezy juz od localStorage przegladarki.
  const draftId = crypto.randomUUID()
  await getStore(STORE_NAME).setJSON(checkoutDraftKey(draftId), {
    planner,
    organizerName,
    organizerContact,
    createdAt: new Date().toISOString(),
  } satisfies CheckoutDraft)

  const base = getPublicSiteBaseUrl(req)
  const stripe = getStripe()

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [
      {
        price_data: {
          currency: 'pln',
          product_data: {
            name: 'Utworzenie wydarzenia online — Lista Prezentów',
            description: 'Jednorazowa oplata za utworzenie wydarzenia i dostep do panelu organizatora.',
          },
          unit_amount: EVENT_CREATE_AMOUNT_GROSZE,
        },
        quantity: 1,
      },
    ],
    client_reference_id: draftId,
    metadata: {
      purpose: 'event_create',
      draftId,
    },
    success_url: `${base}/?eventCheckout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/?eventCheckout=cancel`,
  })

  if (!session.url) {
    throw new ApiError('Nie udalo sie utworzyc sesji platnosci.', 500)
  }

  return json({ checkoutUrl: session.url })
}

async function handleCreate(req: Request, body: EventApiRequest) {
  if (body.action !== 'create') throw new ApiError('Nieprawidlowa akcja.')
  assertNoSpam(body.spamTrap)

  const payload = body as CreateEventRequest
  const sessionId = requireText(payload.stripeCheckoutSessionId, 'Identyfikator platnosci', 200)
  const session = await retrievePaidEventCreateSession(sessionId)

  // Atomowy claim sesji: jedna platnosc = dokladnie jedno wydarzenie.
  const claimed = await claimStripeCheckoutSession(sessionId)
  if (!claimed) {
    const claim = await readCheckoutClaim(sessionId)
    if (claim?.eventId) {
      const existing = await storage.read(claim.eventId)
      if (existing) {
        // Idempotencja: ponowne wywolanie z tym samym session_id zwraca juz utworzone wydarzenie.
        return json({ event: stripPrivateData(existing, req, true) })
      }
    }
    throw new ApiError(
      'Tworzenie wydarzenia dla tej platnosci jest w toku. Odswiez strone za chwile.',
      409,
    )
  }

  let record: EventRecord
  let draftId = ''

  try {
    draftId = cleanText(session.metadata?.draftId ?? session.client_reference_id, 100)
    if (!draftId) {
      throw new ApiError('Platnosc nie ma przypisanego szkicu wydarzenia. Skontaktuj sie z pomoca.', 400)
    }

    const draft = (await getStore(STORE_NAME).get(checkoutDraftKey(draftId), {
      type: 'json',
      consistency: 'strong',
    })) as CheckoutDraft | null
    if (!draft) {
      throw new ApiError('Nie znaleziono szkicu wydarzenia dla tej platnosci. Skontaktuj sie z pomoca.', 404)
    }

    const planner = validatePlanner(draft.planner)
    const now = new Date().toISOString()
    const createdBy = `${requireText(draft.organizerName, 'Imie organizatora', 120)} <${requireText(
      draft.organizerContact,
      'Kontakt organizatora',
      160,
    )}>`

    record = {
      id: createEventSlug(planner.event.childName),
      organizerToken: crypto.randomUUID(),
      version: CURRENT_VERSION,
      status: 'active',
      visibility: 'public_link',
      createdBy,
      lastUpdatedBy: createdBy,
      planner,
      createdAt: now,
      updatedAt: now,
    }

    await getStore(STORE_NAME).setJSON(getStoreKey(record.id), record)
  } catch (error) {
    // Wydarzenie nie powstalo — zwolnienie claimu pozwala ponowic probe bez utraty platnosci.
    try {
      await releaseCheckoutClaim(sessionId)
    } catch (releaseError) {
      console.error('Nie udalo sie zwolnic claimu sesji Stripe', releaseError)
    }
    throw error
  }

  // Od tego miejsca wydarzenie istnieje — claimu nie wolno juz zwalniac (grozi duplikatem).
  try {
    await finalizeCheckoutClaim(sessionId, record.id)
  } catch (error) {
    console.error('Nie udalo sie zapisac eventId w claimie sesji Stripe', error)
  }

  try {
    await getStore(STORE_NAME).delete(checkoutDraftKey(draftId))
  } catch {
    // Sprzatanie szkicu jest best-effort; osierocony szkic nie szkodzi.
  }

  return json({
    event: stripPrivateData(record, req, true),
  })
}

async function handlePublicWrite(req: Request, body: EventApiRequest) {
  if (body.action !== 'reserveGift' && body.action !== 'submitRsvp') {
    throw new ApiError('Nieprawidlowa akcja.')
  }
  assertNoSpam(body.spamTrap)

  // Mutacja w petli retry: walidacja (np. "prezent juz zarezerwowany") liczy sie
  // wzgledem swiezego stanu przy kazdej probie — rownolegle zapisy gosci sie nie nadpisuja.
  const saved = await updateEventWithRetry(body.id, (record) => {
    if (record.status !== 'active') {
      throw new ApiError('To wydarzenie nie przyjmuje juz odpowiedzi.')
    }

    if (body.action === 'reserveGift') {
      const payload = validateReservation(record, body.reservation)
      const reservation: Reservation = {
        ...payload,
        id: createId('reservation'),
        status: 'pending',
        createdAt: new Date().toISOString(),
      }

      record.planner.reservations = [...record.planner.reservations, reservation]
      return payload.contact
    }

    const payload = validateRsvp(record, body.rsvp)
    const existing = record.planner.rsvps.find((rsvp) =>
      contactsEquivalent(rsvp.contact, payload.contact),
    )
    const rsvp: Rsvp = {
      ...payload,
      id: existing?.id ?? createId('rsvp'),
      updatedAt: new Date().toISOString(),
    }

    if (!existing && record.planner.rsvps.length >= MAX_RSVPS) {
      throw new ApiError('Lista gosci jest pelna.')
    }

    record.planner.rsvps = existing
      ? record.planner.rsvps.map((item) => (item.id === existing.id ? rsvp : item))
      : [...record.planner.rsvps, rsvp]

    return payload.contact
  })

  return json({ event: stripPrivateData(saved, req, false) })
}

async function handleManagedWrite(req: Request, body: EventApiRequest) {
  if (
    body.action !== 'updateEvent' &&
    body.action !== 'updateGuestList' &&
    body.action !== 'addGift' &&
    body.action !== 'updateReservationStatus'
  ) {
    throw new ApiError('Nieprawidlowa akcja.')
  }

  if (!body.id || !body.token) {
    throw new ApiError('Brakuje identyfikatora wydarzenia lub tokenu.', 400)
  }

  const saved = await updateEventWithRetry(body.id, (record) => {
    if (record.organizerToken !== body.token) {
      throw new ApiError('Nieprawidlowy link organizatora.', 403)
    }

    if (body.action === 'updateEvent') {
      record.planner.event = validateEventDetails(body.event)
    }

    if (body.action === 'updateGuestList') {
      record.planner.guestList = validateGuestList(body.guestList)
    }

    if (body.action === 'addGift') {
      if (record.planner.gifts.length >= MAX_GIFTS) {
        throw new ApiError('Lista prezentow jest pelna.')
      }
      record.planner.gifts = [
        ...record.planner.gifts,
        {
          ...validateGift(body.gift),
          id: createId('gift'),
        },
      ]
    }

    if (body.action === 'updateReservationStatus') {
      if (!['pending', 'approved', 'rejected', 'bought'].includes(body.status)) {
        throw new ApiError('Nieprawidlowy status rezerwacji.')
      }

      const target = record.planner.reservations.find(
        (reservation) => reservation.id === body.reservationId,
      )
      if (!target) throw new ApiError('Nie znaleziono rezerwacji.', 404)

      record.planner.reservations = record.planner.reservations.map((reservation) => {
        if (reservation.id === body.reservationId) {
          return { ...reservation, status: body.status as ReservationStatus }
        }

        if (
          body.status === 'approved' &&
          reservation.giftId === target.giftId &&
          reservation.status === 'pending'
        ) {
          return { ...reservation, status: 'rejected' }
        }

        return reservation
      })
    }

    return record.createdBy
  })

  return json({ event: stripPrivateData(saved, req, true) })
}

async function handlePost(req: Request) {
  const body = (await req.json()) as EventApiRequest

  if (body.action === 'createEventCheckout') return handleCreateEventCheckout(req, body)
  if (body.action === 'create') return handleCreate(req, body)
  if (body.action === 'reserveGift' || body.action === 'submitRsvp') {
    return handlePublicWrite(req, body)
  }

  return handleManagedWrite(req, body)
}

export default async (req: Request) => {
  try {
    // `await` jest konieczny: bez niego odrzucona promesa omija try/catch
    // i ApiError wychodzi jako surowe 500 zamiast czytelnego JSON-a.
    if (req.method === 'GET') return await handleGet(req)
    if (req.method === 'POST') return await handlePost(req)

    return json({ error: 'Metoda nie jest obslugiwana.' }, { status: 405 })
  } catch (error) {
    if (error instanceof ApiError) {
      return json({ error: error.message }, { status: error.status })
    }

    console.error(error)
    return json({ error: 'Wystapil nieoczekiwany blad serwera.' }, { status: 500 })
  }
}
