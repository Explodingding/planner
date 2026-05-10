import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { emptyPlanner, initialState } from './demoData'
import {
  EventSummary,
  GiftList,
  GuestForms,
  OrganizerPanel,
  PartnerServices,
  RsvpSummaryPanel,
  SharePanel,
} from './components/PlannerSections'
import type {
  ApiResponse,
  AttendanceStatus,
  EventApiRequest,
  EventDetails,
  Gift,
  Guest,
  PlannerState,
  PublicEventRecord,
  Reservation,
  ReservationStatus,
  VerifiedGuest,
} from './types'
import { GIFT_CATEGORIES } from './constants'
import './App.css'

const DRAFT_STORAGE_KEY = 'prezentownik-production-draft'
const API_URL = '/.netlify/functions/events'

type RouteState = {
  eventId: string | null
  organizerToken: string | null
  isRemote: boolean
  isManageRoute: boolean
}

type ManagedActionPayload =
  | {
      action: 'updateEvent'
      event: EventDetails
    }
  | {
      action: 'updateGuestList'
      guestList: Guest[]
    }
  | {
      action: 'addGift'
      gift: Omit<Gift, 'id'>
    }
  | {
      action: 'updateReservationStatus'
      reservationId: string
      status: ReservationStatus
    }

function getRoute(): RouteState {
  const segments = window.location.pathname.split('/').filter(Boolean)
  const token = new URLSearchParams(window.location.search).get('token')
  const isEventRoute = segments[0] === 'event' && Boolean(segments[1])
  const isManageRoute = segments[0] === 'manage' && Boolean(segments[1])

  return {
    eventId: isEventRoute || isManageRoute ? segments[1] : null,
    organizerToken: token,
    isRemote: isEventRoute || isManageRoute,
    isManageRoute,
  }
}

function loadPlannerDraft(): PlannerState {
  try {
    const stored = localStorage.getItem(DRAFT_STORAGE_KEY)
    if (!stored) return emptyPlanner

    const parsed = JSON.parse(stored) as Partial<PlannerState>

    return {
      event: parsed.event ?? emptyPlanner.event,
      guestList: parsed.guestList ?? [],
      gifts: parsed.gifts ?? [],
      reservations: [],
      rsvps: [],
    }
  } catch {
    return emptyPlanner
  }
}

function createId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`
}

function formatDate(value: string) {
  if (!value) return 'Termin do ustalenia'

  return new Intl.DateTimeFormat('pl-PL', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(new Date(value))
}

function formatGuestList(guestList: Guest[]) {
  return guestList.map((guest) => [guest.name, guest.contact].filter(Boolean).join(', ')).join('\n')
}

function parseGuestList(value: string, existingGuests: Guest[] = []) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 120)
    .map((line) => {
      const [rawName, ...contactParts] = line.split(',')
      const name = rawName.trim()
      const contact = contactParts.join(',').trim()
      const existing = existingGuests.find(
        (guest) =>
          guest.name.trim().toLowerCase() === name.toLowerCase() &&
          guest.contact.trim().toLowerCase() === contact.toLowerCase(),
      )

      return {
        id: existing?.id ?? createId('guest'),
        name,
        contact,
      }
    })
}

function normalizeLookup(value: string) {
  return value.trim().toLowerCase()
}

async function readApiResponse(response: Response) {
  const body = (await response.json()) as ApiResponse
  if (!response.ok) throw new Error(body.error ?? 'Nie udalo sie zapisac danych.')
  if (!body.event) throw new Error('Brak danych wydarzenia w odpowiedzi API.')

  return body.event
}

function App() {
  const [route] = useState(getRoute)
  const [planner, setPlanner] = useState<PlannerState>(loadPlannerDraft)
  const [eventRecord, setEventRecord] = useState<PublicEventRecord | null>(null)
  const [isOrganizerOpen, setIsOrganizerOpen] = useState(!route.isRemote || route.isManageRoute)
  const [isLoading, setIsLoading] = useState(route.isRemote)
  const [apiError, setApiError] = useState('')
  const [apiMessage, setApiMessage] = useState('')
  const [createValidationErrors, setCreateValidationErrors] = useState<string[]>([])
  const [organizerName, setOrganizerName] = useState('')
  const [organizerContact, setOrganizerContact] = useState('')
  const [verificationSent, setVerificationSent] = useState(false)
  const [verifiedGuest, setVerifiedGuest] = useState<VerifiedGuest | null>(null)
  const [guestName, setGuestName] = useState('')
  const [guestContact, setGuestContact] = useState('')
  const [selectedGiftId, setSelectedGiftId] = useState(planner.gifts[0]?.id ?? '')
  const [reservationMessage, setReservationMessage] = useState('')
  const [attendanceStatus, setAttendanceStatus] = useState<AttendanceStatus>('yes')
  const [attendanceAdults, setAttendanceAdults] = useState(1)
  const [attendanceChildren, setAttendanceChildren] = useState(1)
  const [attendanceNote, setAttendanceNote] = useState('')
  const [spamTrap, setSpamTrap] = useState('')
  const [guestListText, setGuestListText] = useState(() => formatGuestList(planner.guestList))
  const [newGift, setNewGift] = useState<Omit<Gift, 'id'>>({
    title: '',
    category: GIFT_CATEGORIES[0],
    details: '',
  })

  const canManage = !route.isRemote || Boolean(eventRecord?.canManage)
  const publicUrl = eventRecord?.publicUrl ?? window.location.href
  const manageUrl = eventRecord?.manageUrl

  useEffect(() => {
    if (route.isRemote) return
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(planner))
  }, [planner, route.isRemote])

  useEffect(() => {
    if (!route.eventId) return

    const url = new URL(API_URL, window.location.origin)
    url.searchParams.set('id', route.eventId)
    if (route.organizerToken) url.searchParams.set('token', route.organizerToken)

    fetch(url)
      .then(readApiResponse)
      .then((event) => {
        setEventRecord(event)
        setPlanner(event.planner)
        setGuestListText(formatGuestList(event.planner.guestList))
        setSelectedGiftId(event.planner.gifts[0]?.id ?? '')
        setApiError('')
      })
      .catch((error: Error) => setApiError(error.message))
      .finally(() => setIsLoading(false))
  }, [route.eventId, route.organizerToken])

  const reservationsByGift = useMemo(() => {
    return planner.reservations.reduce<Record<string, Reservation[]>>((groups, reservation) => {
      groups[reservation.giftId] = [...(groups[reservation.giftId] ?? []), reservation]
      return groups
    }, {})
  }, [planner.reservations])

  const pendingReservations = planner.reservations.filter(
    (reservation) => reservation.status === 'pending',
  )

  const approvedReservations = planner.reservations.filter(
    (reservation) => reservation.status === 'approved' || reservation.status === 'bought',
  )

  const rsvpSummary = useMemo(() => {
    return planner.rsvps.reduce(
      (summary, rsvp) => {
        summary[rsvp.status] += 1
        if (rsvp.status === 'yes') {
          summary.adults += rsvp.adults
          summary.children += rsvp.children
        }
        return summary
      },
      { yes: 0, no: 0, maybe: 0, adults: 0, children: 0 },
    )
  }, [planner.rsvps])

  const whatsappText = encodeURIComponent(
    `Czesc! Tu lista prezentow i potwierdzenie obecnosci na urodziny: ${planner.event.childName}. Link: ${publicUrl}`,
  )

  function applyRemoteEvent(event: PublicEventRecord, message: string) {
    setEventRecord(event)
    setPlanner(event.planner)
    setGuestListText(formatGuestList(event.planner.guestList))
    setApiMessage(message)
    setApiError('')
    setCreateValidationErrors([])
  }

  async function callEventApi(body: EventApiRequest) {
    return fetch(API_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }).then(readApiResponse)
  }

  async function persistManagedAction(body: ManagedActionPayload) {
    if (!route.eventId || !route.organizerToken) return

    const event = await callEventApi({
      ...body,
      id: route.eventId,
      token: route.organizerToken,
    } as EventApiRequest)

    applyRemoteEvent(event, 'Zapisano zmiany online.')
  }

  function getGiftState(giftId: string) {
    const giftReservations = reservationsByGift[giftId] ?? []
    if (giftReservations.some((reservation) => reservation.status === 'bought')) return 'kupiony'
    if (giftReservations.some((reservation) => reservation.status === 'approved')) {
      return 'zarezerwowany'
    }
    if (giftReservations.some((reservation) => reservation.status === 'pending')) return 'oczekuje'
    return 'dostepny'
  }

  function updateEvent(field: keyof EventDetails, value: string) {
    setCreateValidationErrors([])
    setPlanner((current) => ({
      ...current,
      event: {
        ...current.event,
        [field]: value,
      },
    }))
  }

  function updateGuestListDraft(value: string) {
    setGuestListText(value)
    setPlanner((current) => ({
      ...current,
      guestList: parseGuestList(value, current.guestList),
    }))
  }

  async function saveGuestList(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const guestList = parseGuestList(guestListText, planner.guestList)
    setPlanner((current) => ({ ...current, guestList }))

    if (!route.isRemote) {
      setApiMessage('Lista gosci zostanie zapisana przy tworzeniu wydarzenia online.')
      setApiError('')
      return
    }

    try {
      await persistManagedAction({ action: 'updateGuestList', guestList })
    } catch (error) {
      setApiError((error as Error).message)
    }
  }

  function validateCreateOnlineEvent() {
    const errors: string[] = []

    if (!organizerName.trim()) errors.push('Podaj imie organizatora.')
    if (!organizerContact.trim()) errors.push('Podaj e-mail lub telefon organizatora.')
    if (!planner.event.childName.trim()) errors.push('Podaj imie dziecka.')
    if (!planner.event.date.trim()) errors.push('Wybierz date i godzine wydarzenia.')
    if (!planner.event.place.trim()) errors.push('Podaj miejsce wydarzenia.')

    setCreateValidationErrors(errors)
    if (errors.length) {
      setApiMessage('')
      setApiError('Uzupelnij wymagane pola przed utworzeniem wydarzenia.')
    }

    return errors.length === 0
  }

  async function saveEventDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!route.isRemote) return

    try {
      await persistManagedAction({ action: 'updateEvent', event: planner.event })
    } catch (error) {
      setApiError((error as Error).message)
    }
  }

  function sendVerification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!guestName.trim() || !guestContact.trim()) return
    setVerificationSent(true)
  }

  function confirmVerification() {
    const guestList = planner.guestList
    const normalizedName = normalizeLookup(guestName)
    const normalizedContact = normalizeLookup(guestContact)
    const listedGuest = guestList.find((guest) => {
      const guestNameMatch = normalizeLookup(guest.name) === normalizedName
      const guestContactMatch = guest.contact && normalizeLookup(guest.contact) === normalizedContact

      return guestContactMatch || guestNameMatch
    })

    if (guestList.length && !listedGuest) {
      setApiMessage('')
      setApiError('Nie znalezlismy tej osoby na liscie gosci. Sprawdz dane albo skontaktuj sie z organizatorem.')
      return
    }

    setVerifiedGuest({
      name: listedGuest?.name ?? guestName.trim(),
      contact: listedGuest?.contact || guestContact.trim(),
    })
    setApiError('')
  }

  async function createOnlineEvent() {
    if (!validateCreateOnlineEvent()) return

    try {
      setApiMessage('Tworze wydarzenie online...')
      setApiError('')
      const event = await callEventApi({
        action: 'create',
        planner: {
          ...planner,
          guestList: parseGuestList(guestListText, planner.guestList),
        },
        organizerName,
        organizerContact,
        spamTrap,
      })

      localStorage.removeItem(DRAFT_STORAGE_KEY)

      if (event.manageUrl) {
        window.location.href = event.manageUrl
        return
      }

      applyRemoteEvent(event, 'Utworzono wydarzenie online.')
    } catch (error) {
      setApiError((error as Error).message)
    }
  }

  async function addGift(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!newGift.title.trim()) return

    const gift = {
      title: newGift.title.trim(),
      category: newGift.category.trim() || 'Inne',
      details: newGift.details.trim(),
    }

    if (route.isRemote) {
      try {
        await persistManagedAction({ action: 'addGift', gift })
        setNewGift({ title: '', category: GIFT_CATEGORIES[0], details: '' })
      } catch (error) {
        setApiError((error as Error).message)
      }
      return
    }

    const localGift = { ...gift, id: createId('gift') }
    setPlanner((current) => ({
      ...current,
      gifts: [...current.gifts, localGift],
    }))
    setNewGift({ title: '', category: GIFT_CATEGORIES[0], details: '' })
    setSelectedGiftId(localGift.id)
  }

  async function requestReservation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!verifiedGuest || !selectedGiftId || !route.eventId) return

    try {
      const remoteEvent = await callEventApi({
        action: 'reserveGift',
        id: route.eventId,
        spamTrap,
        reservation: {
          giftId: selectedGiftId,
          guestName: verifiedGuest.name,
          contact: verifiedGuest.contact,
          message: reservationMessage.trim(),
        },
      })
      applyRemoteEvent(remoteEvent, 'Rezerwacja trafila do zatwierdzenia.')
      setReservationMessage('')
    } catch (error) {
      setApiError((error as Error).message)
    }
  }

  async function submitRsvp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!verifiedGuest || !route.eventId) return

    try {
      const remoteEvent = await callEventApi({
        action: 'submitRsvp',
        id: route.eventId,
        spamTrap,
        rsvp: {
          guestName: verifiedGuest.name,
          contact: verifiedGuest.contact,
          status: attendanceStatus,
          adults: attendanceStatus === 'yes' ? Math.max(0, attendanceAdults) : 0,
          children: attendanceStatus === 'yes' ? Math.max(0, attendanceChildren) : 0,
          note: attendanceNote.trim(),
        },
      })
      applyRemoteEvent(remoteEvent, 'Potwierdzenie obecnosci zapisane.')
      setAttendanceNote('')
    } catch (error) {
      setApiError((error as Error).message)
    }
  }

  async function updateReservationStatus(reservationId: string, status: ReservationStatus) {
    if (!route.isRemote) return

    try {
      await persistManagedAction({ action: 'updateReservationStatus', reservationId, status })
    } catch (error) {
      setApiError((error as Error).message)
    }
  }

  function loadDemoData() {
    setPlanner(initialState)
    setGuestListText(formatGuestList(initialState.guestList))
    setApiMessage('Wczytano dane przykladowe do wersji roboczej.')
    setApiError('')
  }

  function resetDraft() {
    setPlanner(emptyPlanner)
    setGuestListText('')
    setApiMessage('')
    setApiError('')
    localStorage.removeItem(DRAFT_STORAGE_KEY)
  }

  async function copyShareLink(value = publicUrl) {
    await navigator.clipboard.writeText(value)
    setApiMessage('Skopiowano link.')
  }

  if (isLoading) {
    return (
      <main className="app-shell">
        <section className="panel">
          <p className="eyebrow">Prezentownik MVP</p>
          <h1>Laduje wydarzenie...</h1>
        </section>
      </main>
    )
  }

  return (
    <main className="app-shell">
      <section className="hero-section">
        <div className="hero-copy">
          <p className="eyebrow">Prezentownik MVP</p>
          <h1>Kolorowy planner urodzin, prezentow i gosci.</h1>
          <p>
            {route.isRemote
              ? 'Rodzice korzystaja ze wspolnej listy zapisanej w Netlify Blobs.'
              : 'Utworz prawdziwe wydarzenie, dodaj pierwsze pomysly na prezenty i wyslij link rodzicom.'}
          </p>
          <div className="hero-actions">
            {route.isRemote ? (
              <a className="button primary" href="#guest">
                Zglos rezerwacje
              </a>
            ) : (
              <button className="button primary" type="button" onClick={createOnlineEvent}>
                Utworz wydarzenie online
              </button>
            )}
            {canManage ? (
              <a className="button secondary" href="#organizer">
                Panel organizatora
              </a>
            ) : null}
            {!route.isRemote ? (
              <button className="button secondary" type="button" onClick={loadDemoData}>
                Wczytaj przyklad
              </button>
            ) : null}
          </div>
          {apiMessage ? <p className="status-message">{apiMessage}</p> : null}
          {apiError ? <p className="error-message">{apiError}</p> : null}
        </div>
        <EventSummary
          childName={planner.event.childName}
          date={planner.event.date}
          place={planner.event.place}
          giftCount={planner.gifts.length}
          pendingCount={pendingReservations.length}
          approvedCount={approvedReservations.length}
          confirmedCount={rsvpSummary.yes}
          isRemote={route.isRemote}
          formatDate={formatDate}
        />
      </section>

      {!route.isRemote ? (
        <section className="panel organizer-panel" id="organizer">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Tworzenie wydarzenia</p>
              <h2>Dane organizatora i szczegoly urodzin</h2>
              <p>Po utworzeniu dostaniesz prywatny link organizatora i publiczny link dla rodzicow.</p>
            </div>
          </div>
          <div className="grid two-columns organizer-identity">
            <label>
              Imie organizatora
              <input
                value={organizerName}
                onChange={(event) => {
                  setOrganizerName(event.target.value)
                  setCreateValidationErrors([])
                }}
                placeholder="np. Mama Tosi"
                required
              />
            </label>
            <label>
              Kontakt organizatora
              <input
                value={organizerContact}
                onChange={(event) => {
                  setOrganizerContact(event.target.value)
                  setCreateValidationErrors([])
                }}
                placeholder="np. anna@example.com"
                required
              />
            </label>
            <label className="spam-field">
              Website
              <input
                autoComplete="off"
                tabIndex={-1}
                value={spamTrap}
                onChange={(event) => setSpamTrap(event.target.value)}
              />
            </label>
          </div>
          {createValidationErrors.length ? (
            <div className="validation-list" role="alert">
              <strong>Brakuje kilku informacji:</strong>
              <ul>
                {createValidationErrors.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <OrganizerPanel
            planner={planner}
            newGift={newGift}
            pendingReservations={[]}
            approvedReservations={[]}
            isRemote={false}
            onEventChange={updateEvent}
            onSaveEventDetails={(event) => event.preventDefault()}
            guestListText={guestListText}
            onGuestListTextChange={updateGuestListDraft}
            onSaveGuestList={saveGuestList}
            onNewGiftChange={setNewGift}
            onAddGift={addGift}
            onReservationStatusChange={updateReservationStatus}
          />
          <div className="hero-actions">
            <button className="button primary" type="button" onClick={createOnlineEvent}>
              Utworz wydarzenie online
            </button>
            <button className="button secondary" type="button" onClick={resetDraft}>
              Wyczysc wersje robocza
            </button>
          </div>
          <PartnerServices />
        </section>
      ) : (
        <>
          <SharePanel
            theme={planner.event.theme}
            notes={planner.event.notes}
            publicUrl={publicUrl}
            manageUrl={manageUrl}
            whatsappText={whatsappText}
            onCopy={copyShareLink}
          />

          <RsvpSummaryPanel planner={planner} rsvpSummary={rsvpSummary} />

          <section className="panel" id="guest">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Dla wszystkich zaproszonych</p>
                <h2>Publiczna lista prezentow</h2>
                <p>Goscie widza pomysly i moga zglosic rezerwacje po potwierdzeniu osoby.</p>
              </div>
              {verifiedGuest ? (
                <span className="pill success">Zalogowano jako {verifiedGuest.name}</span>
              ) : (
                <span className="pill">Wymagane potwierdzenie</span>
              )}
            </div>

            <GiftList
              planner={planner}
              reservationsByGift={reservationsByGift}
              getGiftState={getGiftState}
            />

            <GuestForms
              planner={planner}
              verifiedGuest={verifiedGuest}
              guestName={guestName}
              guestContact={guestContact}
              verificationSent={verificationSent}
              selectedGiftId={selectedGiftId}
              reservationMessage={reservationMessage}
              attendanceStatus={attendanceStatus}
              attendanceAdults={attendanceAdults}
              attendanceChildren={attendanceChildren}
              attendanceNote={attendanceNote}
              spamTrap={spamTrap}
              onGuestNameChange={setGuestName}
              onGuestContactChange={setGuestContact}
              onSendVerification={sendVerification}
              onConfirmVerification={confirmVerification}
              onSelectedGiftChange={setSelectedGiftId}
              onReservationMessageChange={setReservationMessage}
              onAttendanceStatusChange={setAttendanceStatus}
              onAttendanceAdultsChange={setAttendanceAdults}
              onAttendanceChildrenChange={setAttendanceChildren}
              onAttendanceNoteChange={setAttendanceNote}
              onSpamTrapChange={setSpamTrap}
              onRequestReservation={requestReservation}
              onSubmitRsvp={submitRsvp}
            />
          </section>

          {canManage ? (
            <section className="panel organizer-panel" id="organizer">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Panel organizatora</p>
                  <h2>Zarzadzanie wydarzeniem</h2>
                </div>
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => setIsOrganizerOpen((value) => !value)}
                >
                  {isOrganizerOpen ? 'Ukryj panel' : 'Pokaz panel'}
                </button>
              </div>

              {isOrganizerOpen ? (
                <>
                  <OrganizerPanel
                    planner={planner}
                    newGift={newGift}
                    pendingReservations={pendingReservations}
                    approvedReservations={approvedReservations}
                    isRemote={route.isRemote}
                    onEventChange={updateEvent}
                    onSaveEventDetails={saveEventDetails}
                    guestListText={guestListText}
                    onGuestListTextChange={updateGuestListDraft}
                    onSaveGuestList={saveGuestList}
                    onNewGiftChange={setNewGift}
                    onAddGift={addGift}
                    onReservationStatusChange={updateReservationStatus}
                  />
                  <PartnerServices />
                </>
              ) : null}
            </section>
          ) : null}
        </>
      )}

      <section className="footer-panel">
        <p>
          {route.isRemote
            ? 'To wydarzenie korzysta z Netlify Functions i Netlify Blobs, wiec rodzice widza wspolna liste.'
            : 'To produkcyjny flow tworzenia wydarzenia. Demo jest dostepne tylko jako przykladowy seed formularza.'}
        </p>
      </section>
    </main>
  )
}

export default App
