import { webcrypto } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { EventRecord, PlannerState } from '../src/types'

// Node 18 nie ma globalnego `crypto` (na produkcji Netlify uzywa Node 20+).
if (!globalThis.crypto) {
  globalThis.crypto = webcrypto as Crypto
}

/**
 * Testy funkcji API wydarzeń: walidacje, maskowanie danych publicznych,
 * archiwizacja, flow płatności Stripe (mock) i idempotencja `create`.
 */

// ── Mock Netlify Blobs: pamięciowy store z semantyką etag / onlyIfNew / onlyIfMatch ──

type StoredEntry = { value: string; etag: string }

const memoryStores = new Map<string, Map<string, StoredEntry>>()
let etagCounter = 0

vi.mock('@netlify/blobs', () => {
  function getStore(nameOrOptions: string | { name: string }) {
    const name = typeof nameOrOptions === 'string' ? nameOrOptions : nameOrOptions.name
    if (!memoryStores.has(name)) memoryStores.set(name, new Map())
    const data = memoryStores.get(name)!

    return {
      async get(key: string, options?: { type?: string }) {
        const entry = data.get(key)
        if (!entry) return null
        return options?.type === 'json' ? JSON.parse(entry.value) : entry.value
      },
      async getWithMetadata(key: string, options?: { type?: string }) {
        const entry = data.get(key)
        if (!entry) return null
        return {
          data: options?.type === 'json' ? JSON.parse(entry.value) : entry.value,
          etag: entry.etag,
          metadata: {},
        }
      },
      async setJSON(
        key: string,
        value: unknown,
        options?: { onlyIfNew?: boolean; onlyIfMatch?: string },
      ) {
        const existing = data.get(key)
        if (options?.onlyIfNew && existing) return { modified: false }
        if (options?.onlyIfMatch && existing?.etag !== options.onlyIfMatch) {
          return { modified: false }
        }
        etagCounter += 1
        const etag = `etag-${etagCounter}`
        data.set(key, { value: JSON.stringify(value), etag })
        return { modified: true, etag }
      },
      async delete(key: string) {
        data.delete(key)
      },
    }
  }

  return { getStore }
})

// ── Mock Stripe ──

const stripeMocks = vi.hoisted(() => ({
  retrieve: vi.fn(),
  create: vi.fn(),
}))

vi.mock('stripe', () => ({
  default: class StripeMock {
    checkout = {
      sessions: {
        retrieve: stripeMocks.retrieve,
        create: stripeMocks.create,
      },
    }
  },
}))

process.env.STRIPE_SECRET_KEY = 'sk_test_mock'
process.env.URL = 'https://site.test'

import handler, {
  isEventExpired,
  maskPhoneForPublic,
  maybeArchiveExpiredEvent,
  phonesEquivalent,
  safeGiftLink,
  stripPrivateData,
  validateGiftLink,
  validateGuestList,
} from '../netlify/functions/events'

// ── Pomocnicze dane ──

function makePlanner(overrides: Partial<PlannerState> = {}): PlannerState {
  return {
    event: {
      childName: 'Misia',
      date: '2030-06-01T15:00:00.000Z',
      place: 'Sala zabaw',
      theme: '',
      notes: '',
      giftClothingSizes: '',
      giftColorNotes: '',
      giftMediaFavorites: '',
      giftWishListNotes: '',
    },
    guestList: [],
    gifts: [{ id: 'gift-1', title: 'Klocki', category: 'Zabawki', details: '', link: '' }],
    reservations: [],
    rsvps: [],
    ...overrides,
  }
}

function makeRecord(overrides: Partial<EventRecord> = {}): EventRecord {
  return {
    id: 'misia-abc12345',
    organizerToken: 'token-secret',
    version: 1,
    status: 'active',
    visibility: 'public_link',
    createdBy: 'Org <org@example.com>',
    lastUpdatedBy: 'Org <org@example.com>',
    planner: makePlanner(),
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function eventsStore() {
  if (!memoryStores.has('planner-events')) memoryStores.set('planner-events', new Map())
  return memoryStores.get('planner-events')!
}

function seedRecord(record: EventRecord) {
  etagCounter += 1
  eventsStore().set(`events/${record.id}`, {
    value: JSON.stringify(record),
    etag: `etag-${etagCounter}`,
  })
}

function postRequest(body: unknown) {
  return new Request('https://site.test/.netlify/functions/events', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  memoryStores.clear()
  stripeMocks.retrieve.mockReset()
  stripeMocks.create.mockReset()
})

// ── Walidacje ──

describe('validateGiftLink', () => {
  it('akceptuje https i dokleja protokol do golej domeny', () => {
    expect(validateGiftLink('https://sklep.pl/oferta')).toBe('https://sklep.pl/oferta')
    expect(validateGiftLink('sklep.pl/oferta')).toBe('https://sklep.pl/oferta')
  })

  it('odrzuca protokoly inne niz http/https', () => {
    expect(() => validateGiftLink('javascript:alert(1)')).toThrowError()
    expect(() => validateGiftLink('ftp://serwer/plik')).toThrowError()
  })

  it('puste pole jest dozwolone', () => {
    expect(validateGiftLink('')).toBe('')
  })
})

describe('safeGiftLink', () => {
  it('zwraca pusty string zamiast bledu dla niebezpiecznych wartosci', () => {
    expect(safeGiftLink('javascript:alert(1)')).toBe('')
    expect(safeGiftLink('https://ok.pl')).toBe('https://ok.pl/')
  })
})

describe('phonesEquivalent', () => {
  it('rozpoznaje warianty tego samego numeru PL', () => {
    expect(phonesEquivalent('+48 600 100 200', '600100200')).toBe(true)
    expect(phonesEquivalent('0048600100200', '600-100-200')).toBe(true)
  })

  it('rozne numery nie sa rownowazne', () => {
    expect(phonesEquivalent('600100200', '600100201')).toBe(false)
  })

  it('za krotkie numery nigdy nie pasuja', () => {
    expect(phonesEquivalent('12345', '12345')).toBe(false)
  })
})

describe('validateGuestList', () => {
  it('deduplikuje ten sam numer w roznych formatach i odrzuca niekompletne wpisy', () => {
    const result = validateGuestList([
      { id: 'g1', name: 'Anna', contact: '+48 600 100 200' },
      { id: 'g2', name: 'Anna dubel', contact: '600100200' },
      { id: 'g3', name: 'Bez numeru', contact: '' },
      { id: 'g4', name: '', contact: '600100300' },
      { id: 'g5', name: 'Basia', contact: '600 100 300' },
    ])

    expect(result.map((guest) => guest.name)).toEqual(['Anna', 'Basia'])
  })
})

describe('maskPhoneForPublic', () => {
  it('zostawia tylko ostatnie 3 cyfry', () => {
    expect(maskPhoneForPublic('600100200')).toBe('*** *** 200')
  })

  it('zwraca pusty string dla zbyt krotkich danych', () => {
    expect(maskPhoneForPublic('12')).toBe('')
  })
})

// ── Maskowanie danych publicznych ──

describe('stripPrivateData', () => {
  const req = new Request('https://site.test/.netlify/functions/events')

  function recordWithPrivateData() {
    return makeRecord({
      planner: makePlanner({
        guestList: [{ id: 'g1', name: 'Anna', contact: '600100200' }],
        reservations: [
          {
            id: 'r1',
            giftId: 'gift-1',
            guestName: 'Anna',
            contact: '600100200',
            message: 'Kupie klocki',
            status: 'pending',
            createdAt: '2026-01-02T00:00:00.000Z',
          },
        ],
        rsvps: [
          {
            id: 'rsvp1',
            guestName: 'Anna',
            contact: '600100200',
            status: 'yes',
            adults: 2,
            children: 1,
            note: 'Bedziemy!',
            updatedAt: '2026-01-02T00:00:00.000Z',
          },
        ],
      }),
    })
  }

  it('widok publiczny maskuje kontakty i ukrywa wiadomosci', () => {
    const result = stripPrivateData(recordWithPrivateData(), req, false)

    expect(result.canManage).toBe(false)
    expect(result.manageUrl).toBeUndefined()
    expect(result.planner.guestList[0].contact).toBe('*** *** 200')
    expect(result.planner.reservations[0].contact).toBe('')
    expect(result.planner.reservations[0].message).toBe('')
    expect(result.planner.rsvps[0].contact).toBe('')
    expect(result.planner.rsvps[0].note).toBe('')
  })

  it('widok organizatora zachowuje dane i zwraca link z tokenem', () => {
    const result = stripPrivateData(recordWithPrivateData(), req, true)

    expect(result.canManage).toBe(true)
    expect(result.manageUrl).toContain('token=token-secret')
    expect(result.planner.guestList[0].contact).toBe('600100200')
    expect(result.planner.reservations[0].message).toBe('Kupie klocki')
  })
})

// ── Archiwizacja ──

describe('archiwizacja wydarzen', () => {
  it('wydarzenie po ARCHIVE_AFTER_DAYS od daty jest wygasle, przyszle nie', () => {
    const past = makeRecord({
      planner: makePlanner({
        event: { ...makePlanner().event, date: '2026-01-01T12:00:00.000Z' },
      }),
    })
    expect(isEventExpired(past, new Date('2026-03-01T12:00:00.000Z'))).toBe(true)
    expect(isEventExpired(past, new Date('2026-01-15T12:00:00.000Z'))).toBe(false)

    const future = makeRecord()
    expect(isEventExpired(future, new Date('2026-06-09T00:00:00.000Z'))).toBe(false)
  })

  it('archiwizacja czysci kontakty gosci, rezerwacji i RSVP', () => {
    const record = makeRecord({
      planner: makePlanner({
        event: { ...makePlanner().event, date: '2026-01-01T12:00:00.000Z' },
        guestList: [{ id: 'g1', name: 'Anna', contact: '600100200' }],
        reservations: [
          {
            id: 'r1',
            giftId: 'gift-1',
            guestName: 'Anna',
            contact: '600100200',
            message: 'wiadomosc',
            status: 'approved',
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        rsvps: [
          {
            id: 'rsvp1',
            guestName: 'Anna',
            contact: '600100200',
            status: 'yes',
            adults: 1,
            children: 1,
            note: 'notatka',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      }),
    })

    const archived = maybeArchiveExpiredEvent(record, new Date('2026-06-01T00:00:00.000Z'))

    expect(archived.status).toBe('archived')
    expect(archived.planner.guestList[0].contact).toBe('')
    expect(archived.planner.reservations[0].contact).toBe('')
    expect(archived.planner.reservations[0].message).toBe('')
    expect(archived.planner.rsvps[0].contact).toBe('')
    expect(archived.planner.rsvps[0].note).toBe('')
    // Imiona i statusy zostaja — organizator nadal widzi historie.
    expect(archived.planner.guestList[0].name).toBe('Anna')
    expect(archived.planner.reservations[0].status).toBe('approved')
  })

  it('GET archiwizuje wygasle wydarzenie i utrwala zmiane w storze', async () => {
    const record = makeRecord({
      planner: makePlanner({
        event: { ...makePlanner().event, date: '2020-01-01T12:00:00.000Z' },
        guestList: [{ id: 'g1', name: 'Anna', contact: '600100200' }],
      }),
    })
    seedRecord(record)

    const response = await handler(
      new Request(`https://site.test/.netlify/functions/events?id=${record.id}`),
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.event.status).toBe('archived')

    const stored = JSON.parse(eventsStore().get(`events/${record.id}`)!.value) as EventRecord
    expect(stored.status).toBe('archived')
    expect(stored.planner.guestList[0].contact).toBe('')
  })
})

// ── Publiczne zapisy ──

describe('reserveGift', () => {
  it('odrzuca rezerwacje numeru spoza listy zaproszonych', async () => {
    const record = makeRecord({
      planner: makePlanner({
        guestList: [{ id: 'g1', name: 'Anna', contact: '600100200' }],
      }),
    })
    seedRecord(record)

    const response = await handler(
      postRequest({
        action: 'reserveGift',
        id: record.id,
        reservation: {
          giftId: 'gift-1',
          guestName: 'Obcy',
          contact: '999888777',
          message: '',
        },
      }),
    )

    expect(response.status).toBe(403)
  })

  it('zapisuje rezerwacje dla goscia z listy i blokuje zajety prezent', async () => {
    const record = makeRecord({
      planner: makePlanner({
        guestList: [
          { id: 'g1', name: 'Anna', contact: '600100200' },
          { id: 'g2', name: 'Basia', contact: '600100300' },
        ],
      }),
    })
    seedRecord(record)

    const first = await handler(
      postRequest({
        action: 'reserveGift',
        id: record.id,
        reservation: { giftId: 'gift-1', guestName: '', contact: '+48600100200', message: 'biore' },
      }),
    )
    expect(first.status).toBe(200)

    // Zatwierdzenie rezerwacji przez organizatora.
    const stored = JSON.parse(eventsStore().get(`events/${record.id}`)!.value) as EventRecord
    const reservationId = stored.planner.reservations[0].id
    const approve = await handler(
      postRequest({
        action: 'updateReservationStatus',
        id: record.id,
        token: 'token-secret',
        reservationId,
        status: 'approved',
      }),
    )
    expect(approve.status).toBe(200)

    // Drugi gosc nie moze juz zarezerwowac tego samego prezentu.
    const second = await handler(
      postRequest({
        action: 'reserveGift',
        id: record.id,
        reservation: { giftId: 'gift-1', guestName: '', contact: '600100300', message: '' },
      }),
    )
    expect(second.status).toBe(400)
    const body = await second.json()
    expect(body.error).toContain('zarezerwowany')
  })
})

describe('submitRsvp', () => {
  it('aktualizuje istniejace RSVP zamiast dublowac wpis', async () => {
    const record = makeRecord({
      planner: makePlanner({
        guestList: [{ id: 'g1', name: 'Anna', contact: '600100200' }],
      }),
    })
    seedRecord(record)

    const yes = await handler(
      postRequest({
        action: 'submitRsvp',
        id: record.id,
        rsvp: { guestName: '', contact: '600100200', status: 'yes', adults: 2, children: 1, note: '' },
      }),
    )
    expect(yes.status).toBe(200)

    const no = await handler(
      postRequest({
        action: 'submitRsvp',
        id: record.id,
        rsvp: { guestName: '', contact: '+48 600 100 200', status: 'no', adults: 0, children: 0, note: '' },
      }),
    )
    expect(no.status).toBe(200)

    const stored = JSON.parse(eventsStore().get(`events/${record.id}`)!.value) as EventRecord
    expect(stored.planner.rsvps).toHaveLength(1)
    expect(stored.planner.rsvps[0].status).toBe('no')
  })
})

// ── Flow platnosci: create + idempotencja ──

describe('create po platnosci Stripe', () => {
  function paidSession(draftId: string) {
    return {
      mode: 'payment',
      payment_status: 'paid',
      metadata: { purpose: 'event_create', draftId },
      client_reference_id: draftId,
      amount_total: 500,
      currency: 'pln',
    }
  }

  async function seedDraft(draftId: string) {
    etagCounter += 1
    eventsStore().set(`checkout-drafts/${draftId}`, {
      value: JSON.stringify({
        planner: makePlanner(),
        organizerName: 'Org',
        organizerContact: 'org@example.com',
        createdAt: new Date().toISOString(),
      }),
      etag: `etag-${etagCounter}`,
    })
  }

  it('tworzy wydarzenie ze snapshotu i jest idempotentne dla tego samego session_id', async () => {
    const draftId = 'draft-123'
    await seedDraft(draftId)
    stripeMocks.retrieve.mockResolvedValue(paidSession(draftId))

    const first = await handler(
      postRequest({ action: 'create', stripeCheckoutSessionId: 'cs_test_abc' }),
    )
    expect(first.status).toBe(200)
    const firstBody = await first.json()
    expect(firstBody.event.canManage).toBe(true)
    expect(firstBody.event.manageUrl).toContain('token=')

    // Szkic po udanym utworzeniu jest sprzatany.
    expect(eventsStore().has(`checkout-drafts/${draftId}`)).toBe(false)

    // Ponowne create z tym samym session_id zwraca to samo wydarzenie (bez duplikatu).
    const second = await handler(
      postRequest({ action: 'create', stripeCheckoutSessionId: 'cs_test_abc' }),
    )
    expect(second.status).toBe(200)
    const secondBody = await second.json()
    expect(secondBody.event.id).toBe(firstBody.event.id)

    const eventKeys = [...eventsStore().keys()].filter((key) => key.startsWith('events/'))
    expect(eventKeys).toHaveLength(1)
  })

  it('odrzuca nieoplacona sesje', async () => {
    stripeMocks.retrieve.mockResolvedValue({
      mode: 'payment',
      payment_status: 'unpaid',
      metadata: { purpose: 'event_create', draftId: 'x' },
      amount_total: 500,
      currency: 'pln',
    })

    const response = await handler(
      postRequest({ action: 'create', stripeCheckoutSessionId: 'cs_test_unpaid' }),
    )
    expect(response.status).toBe(402)
  })

  it('odrzuca sesje o niezgodnej kwocie', async () => {
    stripeMocks.retrieve.mockResolvedValue({
      mode: 'payment',
      payment_status: 'paid',
      metadata: { purpose: 'event_create', draftId: 'x' },
      amount_total: 100,
      currency: 'pln',
    })

    const response = await handler(
      postRequest({ action: 'create', stripeCheckoutSessionId: 'cs_test_cheap' }),
    )
    expect(response.status).toBe(400)
  })

  it('po bledzie (brak szkicu) zwalnia claim i pozwala ponowic', async () => {
    stripeMocks.retrieve.mockResolvedValue(paidSession('draft-missing'))

    const failed = await handler(
      postRequest({ action: 'create', stripeCheckoutSessionId: 'cs_test_retry' }),
    )
    expect(failed.status).toBe(404)

    // Claim zostal zwolniony — po uzupelnieniu szkicu create przechodzi.
    await seedDraft('draft-missing')
    const retried = await handler(
      postRequest({ action: 'create', stripeCheckoutSessionId: 'cs_test_retry' }),
    )
    expect(retried.status).toBe(200)
  })
})

// ── createEventCheckout: walidacja przed platnoscia ──

describe('createEventCheckout', () => {
  it('waliduje szkic przed utworzeniem sesji platnosci', async () => {
    const response = await handler(
      postRequest({
        action: 'createEventCheckout',
        planner: makePlanner({
          event: { ...makePlanner().event, childName: '' },
        }),
        organizerName: 'Org',
        organizerContact: 'org@example.com',
      }),
    )

    expect(response.status).toBe(400)
    expect(stripeMocks.create).not.toHaveBeenCalled()
  })

  it('zapisuje snapshot szkicu i przekazuje draftId do Stripe', async () => {
    stripeMocks.create.mockResolvedValue({ url: 'https://checkout.stripe.com/c/pay/x' })

    const response = await handler(
      postRequest({
        action: 'createEventCheckout',
        planner: makePlanner(),
        organizerName: 'Org',
        organizerContact: 'org@example.com',
      }),
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.checkoutUrl).toContain('checkout.stripe.com')

    const createArgs = stripeMocks.create.mock.calls[0][0]
    expect(createArgs.metadata.purpose).toBe('event_create')
    expect(createArgs.metadata.draftId).toBeTruthy()

    const draftKeys = [...eventsStore().keys()].filter((key) =>
      key.startsWith('checkout-drafts/'),
    )
    expect(draftKeys).toHaveLength(1)
  })
})
