import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { initialState } from './demoData'
import type {
  AttendanceStatus,
  EventDetails,
  PlannerState,
  PublicEventRecord,
  Reservation,
  ReservationStatus,
  Rsvp,
  VerifiedGuest,
} from './types'
import './App.css'

const STORAGE_KEY = 'prezentownik-mvp'
const API_URL = '/.netlify/functions/events'
const GIFT_CATEGORIES = [
  'Klocki',
  'Ksiazki',
  'Gry i puzzle',
  'Kreatywne',
  'Sport i ruch',
  'Edukacyjne',
  'Ubranka i dodatki',
  'Elektronika dla dzieci',
  'Inne',
]

const ORGANIZER_SERVICES = [
  {
    title: 'Sale zabaw',
    description: 'Docelowo: wolne terminy, pakiety urodzinowe i rezerwacja sali z aplikacji.',
    action: 'Zapytaj o termin',
  },
  {
    title: 'Torty i cukiernie',
    description: 'Lista lokalnych cukierni, inspiracje tortow i przekierowanie do zamowienia.',
    action: 'Wybierz cukiernie',
  },
  {
    title: 'Animatorzy',
    description: 'Animatorzy do domu, ogrodu, sali lub pleneru, z tematami zabaw dla dzieci.',
    action: 'Znajdz animatora',
  },
  {
    title: 'Dekoracje',
    description: 'Balony, scianki, girlandy i dekoratorzy, ktorzy przygotuja klimat imprezy.',
    action: 'Zobacz dekoracje',
  },
]

type RouteState = {
  eventId: string | null
  organizerToken: string | null
  isRemote: boolean
  isManageRoute: boolean
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

function loadPlannerState(): PlannerState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return initialState

    const parsed = JSON.parse(stored) as Partial<PlannerState>

    return {
      event: parsed.event ?? initialState.event,
      gifts: parsed.gifts ?? initialState.gifts,
      reservations: parsed.reservations ?? initialState.reservations,
      rsvps: parsed.rsvps ?? initialState.rsvps,
    }
  } catch {
    return initialState
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

async function readApiResponse(response: Response) {
  const body = (await response.json()) as { event?: PublicEventRecord; error?: string }
  if (!response.ok) {
    throw new Error(body.error ?? 'Nie udalo sie zapisac danych.')
  }

  if (!body.event) {
    throw new Error('Brak danych wydarzenia w odpowiedzi API.')
  }

  return body.event
}

function App() {
  const [route] = useState(getRoute)
  const [planner, setPlanner] = useState<PlannerState>(loadPlannerState)
  const [eventRecord, setEventRecord] = useState<PublicEventRecord | null>(null)
  const [isOrganizerOpen, setIsOrganizerOpen] = useState(!route.isRemote || route.isManageRoute)
  const [isLoading, setIsLoading] = useState(route.isRemote)
  const [apiError, setApiError] = useState('')
  const [apiMessage, setApiMessage] = useState('')
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
  const [newGift, setNewGift] = useState({
    title: '',
    category: GIFT_CATEGORIES[0],
    details: '',
  })

  const canManage = !route.isRemote || Boolean(eventRecord?.canManage)
  const publicUrl = eventRecord?.publicUrl ?? window.location.href
  const manageUrl = eventRecord?.manageUrl

  useEffect(() => {
    if (route.isRemote) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(planner))
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
    setApiMessage(message)
    setApiError('')
  }

  async function callEventApi(action: string, payload: Record<string, unknown>) {
    const event = await fetch(API_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action, ...payload }),
    }).then(readApiResponse)

    return event
  }

  async function persistManagedAction(action: string, payload: Record<string, unknown>) {
    if (!route.eventId || !route.organizerToken) return

    const event = await callEventApi(action, {
      id: route.eventId,
      token: route.organizerToken,
      ...payload,
    })

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
    setPlanner((current) => ({
      ...current,
      event: {
        ...current.event,
        [field]: value,
      },
    }))
  }

  async function saveEventDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!route.isRemote) return

    try {
      await persistManagedAction('updateEvent', { event: planner.event })
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
    setVerifiedGuest({
      name: guestName.trim(),
      contact: guestContact.trim(),
    })
  }

  async function createOnlineEvent() {
    try {
      setApiMessage('Tworze wydarzenie online...')
      const event = await callEventApi('create', { planner })
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
        await persistManagedAction('addGift', { gift })
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
    if (!verifiedGuest || !selectedGiftId) return

    const reservation = {
      giftId: selectedGiftId,
      guestName: verifiedGuest.name,
      contact: verifiedGuest.contact,
      message: reservationMessage.trim(),
    }

    if (route.isRemote && route.eventId) {
      try {
        const remoteEvent = await callEventApi('reserveGift', {
          id: route.eventId,
          reservation,
        })
        applyRemoteEvent(remoteEvent, 'Rezerwacja trafila do zatwierdzenia.')
        setReservationMessage('')
      } catch (error) {
        setApiError((error as Error).message)
      }
      return
    }

    setPlanner((current) => ({
      ...current,
      reservations: [
        ...current.reservations,
        {
          ...reservation,
          id: createId('reservation'),
          status: 'pending',
          createdAt: new Date().toISOString(),
        },
      ],
    }))
    setReservationMessage('')
  }

  async function submitRsvp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!verifiedGuest) return

    const rsvp = {
      guestName: verifiedGuest.name,
      contact: verifiedGuest.contact,
      status: attendanceStatus,
      adults: attendanceStatus === 'yes' ? Math.max(0, attendanceAdults) : 0,
      children: attendanceStatus === 'yes' ? Math.max(0, attendanceChildren) : 0,
      note: attendanceNote.trim(),
    }

    if (route.isRemote && route.eventId) {
      try {
        const remoteEvent = await callEventApi('submitRsvp', {
          id: route.eventId,
          rsvp,
        })
        applyRemoteEvent(remoteEvent, 'Potwierdzenie obecnosci zapisane.')
        setAttendanceNote('')
      } catch (error) {
        setApiError((error as Error).message)
      }
      return
    }

    setPlanner((current) => {
      const existing = current.rsvps.find((item) => item.contact === verifiedGuest.contact)
      const nextRsvp: Rsvp = {
        ...rsvp,
        id: existing?.id ?? createId('rsvp'),
        updatedAt: new Date().toISOString(),
      }

      return {
        ...current,
        rsvps: existing
          ? current.rsvps.map((item) => (item.id === existing.id ? nextRsvp : item))
          : [...current.rsvps, nextRsvp],
      }
    })
    setAttendanceNote('')
  }

  async function updateReservationStatus(reservationId: string, status: ReservationStatus) {
    if (route.isRemote) {
      try {
        await persistManagedAction('updateReservationStatus', { reservationId, status })
      } catch (error) {
        setApiError((error as Error).message)
      }
      return
    }

    setPlanner((current) => {
      const target = current.reservations.find((reservation) => reservation.id === reservationId)

      return {
        ...current,
        reservations: current.reservations.map((reservation) => {
          if (reservation.id === reservationId) {
            return { ...reservation, status }
          }

          if (
            status === 'approved' &&
            target &&
            reservation.giftId === target.giftId &&
            reservation.status === 'pending'
          ) {
            return { ...reservation, status: 'rejected' }
          }

          return reservation
        }),
      }
    })
  }

  function resetDemo() {
    setPlanner(initialState)
    setVerifiedGuest(null)
    setVerificationSent(false)
    setGuestName('')
    setGuestContact('')
    setReservationMessage('')
    setAttendanceStatus('yes')
    setAttendanceAdults(1)
    setAttendanceChildren(1)
    setAttendanceNote('')
    setSelectedGiftId(initialState.gifts[0]?.id ?? '')
    setApiMessage('')
    setApiError('')
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
            Organizator tworzy wydarzenie, udostepnia link rodzicom, a RSVP i rezerwacje
            zapisują sie we wspolnej bazie Netlify Blobs.
          </p>
          <div className="hero-actions">
            <a className="button primary" href="#guest">
              Zglos rezerwacje
            </a>
            {canManage ? (
              <a className="button secondary" href="#organizer">
                Panel organizatora
              </a>
            ) : null}
            {!route.isRemote ? (
              <button className="button secondary" type="button" onClick={createOnlineEvent}>
                Utworz wydarzenie online
              </button>
            ) : null}
          </div>
          {apiMessage ? <p className="status-message">{apiMessage}</p> : null}
          {apiError ? <p className="error-message">{apiError}</p> : null}
        </div>
        <div className="event-card">
          <span className="card-label">
            {route.isRemote ? 'Wydarzenie online' : 'Demo lokalne'}
          </span>
          <h2>Urodziny: {planner.event.childName}</h2>
          <p>{formatDate(planner.event.date)}</p>
          <p>{planner.event.place}</p>
          <div className="status-row">
            <span>{planner.gifts.length} pomysly</span>
            <span>{pendingReservations.length} oczekuje</span>
            <span>{approvedReservations.length} zatwierdzone</span>
            <span>{rsvpSummary.yes} potwierdzone</span>
          </div>
        </div>
      </section>

      <section className="grid two-columns">
        <article className="panel">
          <p className="eyebrow">Informacje organizacyjne</p>
          <h2>{planner.event.theme}</h2>
          <p>{planner.event.notes}</p>
          <div className="share-box">
            <span>Link dla rodzicow</span>
            <code>{publicUrl}</code>
            <div className="inline-actions">
              <button className="button secondary" type="button" onClick={() => copyShareLink()}>
                Kopiuj link
              </button>
              <a
                className="button secondary"
                href={`https://wa.me/?text=${whatsappText}`}
                rel="noreferrer"
                target="_blank"
              >
                Udostepnij na WhatsApp
              </a>
            </div>
          </div>
          {manageUrl ? (
            <div className="share-box">
              <span>Prywatny link organizatora</span>
              <code>{manageUrl}</code>
              <button
                className="button secondary"
                type="button"
                onClick={() => copyShareLink(manageUrl)}
              >
                Kopiuj link organizatora
              </button>
            </div>
          ) : null}
        </article>

        <article className="panel">
          <p className="eyebrow">Netlify Blobs</p>
          <h2>{route.isRemote ? 'Wspolna lista jest aktywna.' : 'To jest lokalne demo.'}</h2>
          <p>
            Po kliknieciu "Utworz wydarzenie online" aplikacja zapisze event w Netlify
            Blobs i wygeneruje osobny link publiczny oraz prywatny link organizatora.
          </p>
        </article>
      </section>

      <section className="panel rsvp-overview">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Aktualna lista obecnosci</p>
            <h2>Kto bedzie na wydarzeniu?</h2>
          </div>
          <div className="status-row">
            <span className="pill success">{rsvpSummary.yes} tak</span>
            <span className="pill state-oczekuje">{rsvpSummary.maybe} nie wiem</span>
            <span className="pill">{rsvpSummary.no} nie</span>
          </div>
        </div>
        <div className="rsvp-stats">
          <article>
            <strong>{rsvpSummary.adults}</strong>
            <span>doroslych</span>
          </article>
          <article>
            <strong>{rsvpSummary.children}</strong>
            <span>dzieci</span>
          </article>
          <article>
            <strong>{planner.rsvps.length}</strong>
            <span>odpowiedzi</span>
          </article>
        </div>
        <div className="rsvp-list public-rsvp-list">
          {planner.rsvps.length ? (
            planner.rsvps.map((rsvp) => (
              <article className="approval-card" key={rsvp.id}>
                <p className={`pill attendance-${rsvp.status}`}>
                  {rsvp.status === 'yes'
                    ? 'bedziemy'
                    : rsvp.status === 'maybe'
                      ? 'nie wiem'
                      : 'nie bedzie nas'}
                </p>
                <h4>{rsvp.guestName}</h4>
                {rsvp.status === 'yes' ? (
                  <p>
                    {rsvp.adults} doroslych, {rsvp.children} dzieci
                  </p>
                ) : null}
              </article>
            ))
          ) : (
            <p>Jeszcze nikt nie potwierdzil obecnosci.</p>
          )}
        </div>
      </section>

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

        <div className="gift-list">
          {planner.gifts.map((gift) => {
            const giftReservations = reservationsByGift[gift.id] ?? []
            const approved = giftReservations.find(
              (reservation) =>
                reservation.status === 'approved' || reservation.status === 'bought',
            )

            return (
              <article className="gift-card" key={gift.id}>
                <div>
                  <div className="gift-title-row">
                    <h3>{gift.title}</h3>
                    <span className={`pill state-${getGiftState(gift.id)}`}>
                      {getGiftState(gift.id)}
                    </span>
                  </div>
                  <p className="gift-meta">{gift.category}</p>
                  <p>{gift.details}</p>
                </div>
                {approved ? (
                  <p className="reservation-note">Zarezerwowane przez: {approved.guestName}</p>
                ) : null}
              </article>
            )
          })}
        </div>

        <div className="grid two-columns reservation-area">
          <form className="form-card" onSubmit={sendVerification}>
            <h3>1. Potwierdz osobe</h3>
            <label>
              Imie lub opis
              <input
                value={guestName}
                onChange={(event) => setGuestName(event.target.value)}
                placeholder="np. Mama Janka"
              />
            </label>
            <label>
              E-mail lub telefon
              <input
                value={guestContact}
                onChange={(event) => setGuestContact(event.target.value)}
                placeholder="np. anna@example.com"
              />
            </label>
            <button className="button primary" type="submit">
              Wyslij link/kod
            </button>
            {verificationSent ? (
              <div className="verification-box">
                <p>Symulacja MVP: kod zostal wyslany. Kliknij, aby potwierdzic osobe.</p>
                <button className="button secondary" type="button" onClick={confirmVerification}>
                  Potwierdz kod
                </button>
              </div>
            ) : null}
          </form>

          <form className="form-card" onSubmit={requestReservation}>
            <h3>2. Zglos rezerwacje</h3>
            <label>
              Prezent
              <select
                value={selectedGiftId}
                onChange={(event) => setSelectedGiftId(event.target.value)}
              >
                {planner.gifts.map((gift) => (
                  <option key={gift.id} value={gift.id}>
                    {gift.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Wiadomosc dla organizatora
              <textarea
                value={reservationMessage}
                onChange={(event) => setReservationMessage(event.target.value)}
                placeholder="np. Kupie ten prezent razem z paragonem do wymiany."
              />
            </label>
            <button className="button primary" disabled={!verifiedGuest} type="submit">
              Zglos do zatwierdzenia
            </button>
          </form>

          <form className="form-card" onSubmit={submitRsvp}>
            <h3>3. Potwierdz obecnosc</h3>
            <label>
              Czy bedziecie?
              <select
                value={attendanceStatus}
                onChange={(event) => setAttendanceStatus(event.target.value as AttendanceStatus)}
              >
                <option value="yes">Tak, bedziemy</option>
                <option value="maybe">Jeszcze nie wiem</option>
                <option value="no">Nie bedzie nas</option>
              </select>
            </label>
            <div className="mini-grid">
              <label>
                Dorosli
                <input
                  min="0"
                  type="number"
                  value={attendanceAdults}
                  onChange={(event) => setAttendanceAdults(Number(event.target.value))}
                />
              </label>
              <label>
                Dzieci
                <input
                  min="0"
                  type="number"
                  value={attendanceChildren}
                  onChange={(event) => setAttendanceChildren(Number(event.target.value))}
                />
              </label>
            </div>
            <label>
              Notatka dla organizatora
              <textarea
                value={attendanceNote}
                onChange={(event) => setAttendanceNote(event.target.value)}
                placeholder="np. Przyjdziemy we dwoje, ale mozemy sie spoznic 15 minut."
              />
            </label>
            <button className="button primary" disabled={!verifiedGuest} type="submit">
              Zapisz obecnosc
            </button>
          </form>
        </div>
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
            <div className="organizer-grid">
              <form className="form-card" onSubmit={saveEventDetails}>
                <h3>Szczegoly wydarzenia</h3>
                <label>
                  Imie dziecka
                  <input
                    value={planner.event.childName}
                    onChange={(event) => updateEvent('childName', event.target.value)}
                  />
                </label>
                <label>
                  Data i godzina
                  <input
                    type="datetime-local"
                    value={planner.event.date}
                    onChange={(event) => updateEvent('date', event.target.value)}
                  />
                </label>
                <label>
                  Miejsce
                  <input
                    value={planner.event.place}
                    onChange={(event) => updateEvent('place', event.target.value)}
                  />
                </label>
                <label>
                  Temat / krotki opis
                  <input
                    value={planner.event.theme}
                    onChange={(event) => updateEvent('theme', event.target.value)}
                  />
                </label>
                <label>
                  Preferencje i informacje organizacyjne
                  <textarea
                    value={planner.event.notes}
                    onChange={(event) => updateEvent('notes', event.target.value)}
                  />
                </label>
                {route.isRemote ? (
                  <button className="button primary" type="submit">
                    Zapisz szczegoly online
                  </button>
                ) : null}
              </form>

              <form className="form-card" onSubmit={addGift}>
                <h3>Dodaj prezent</h3>
                <label>
                  Nazwa
                  <input
                    value={newGift.title}
                    onChange={(event) => setNewGift({ ...newGift, title: event.target.value })}
                    placeholder="np. Gra planszowa"
                  />
                </label>
                <label>
                  Kategoria
                  <select
                    value={newGift.category}
                    onChange={(event) => setNewGift({ ...newGift, category: event.target.value })}
                  >
                    {GIFT_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Szczegoly
                  <textarea
                    value={newGift.details}
                    onChange={(event) => setNewGift({ ...newGift, details: event.target.value })}
                    placeholder="Co warto wiedziec przed zakupem?"
                  />
                </label>
                <button className="button primary" type="submit">
                  Dodaj do listy
                </button>
              </form>

              <div className="form-card approvals">
                <h3>Zgloszenia do zatwierdzenia</h3>
                {pendingReservations.length ? (
                  pendingReservations.map((reservation) => {
                    const gift = planner.gifts.find((item) => item.id === reservation.giftId)

                    return (
                      <article className="approval-card" key={reservation.id}>
                        <p className="gift-meta">{gift?.title}</p>
                        <h4>{reservation.guestName}</h4>
                        <p>{reservation.contact}</p>
                        {reservation.message ? <p>{reservation.message}</p> : null}
                        <div className="inline-actions">
                          <button
                            className="button primary"
                            type="button"
                            onClick={() => updateReservationStatus(reservation.id, 'approved')}
                          >
                            Zatwierdz
                          </button>
                          <button
                            className="button secondary"
                            type="button"
                            onClick={() => updateReservationStatus(reservation.id, 'rejected')}
                          >
                            Odrzuc
                          </button>
                        </div>
                      </article>
                    )
                  })
                ) : (
                  <p>Brak oczekujacych zgloszen.</p>
                )}
              </div>

              <div className="form-card approvals">
                <h3>Zatwierdzone rezerwacje</h3>
                {approvedReservations.length ? (
                  approvedReservations.map((reservation) => {
                    const gift = planner.gifts.find((item) => item.id === reservation.giftId)

                    return (
                      <article className="approval-card" key={reservation.id}>
                        <p className="gift-meta">{gift?.title}</p>
                        <h4>{reservation.guestName}</h4>
                        <p>{reservation.contact}</p>
                        <div className="inline-actions">
                          <button
                            className="button secondary"
                            type="button"
                            onClick={() => updateReservationStatus(reservation.id, 'bought')}
                          >
                            Oznacz jako kupiony
                          </button>
                        </div>
                      </article>
                    )
                  })
                ) : (
                  <p>Jeszcze nie ma zatwierdzonych rezerwacji.</p>
                )}
              </div>

              <div className="form-card approvals full-width">
                <h3>Lista obecnosci</h3>
                {planner.rsvps.length ? (
                  <div className="rsvp-list">
                    {planner.rsvps.map((rsvp) => (
                      <article className="approval-card" key={rsvp.id}>
                        <p className={`pill attendance-${rsvp.status}`}>
                          {rsvp.status === 'yes'
                            ? 'bedziemy'
                            : rsvp.status === 'maybe'
                              ? 'nie wiem'
                              : 'nie bedzie nas'}
                        </p>
                        <h4>{rsvp.guestName}</h4>
                        <p>{rsvp.contact}</p>
                        {rsvp.status === 'yes' ? (
                          <p>
                            {rsvp.adults} doroslych, {rsvp.children} dzieci
                          </p>
                        ) : null}
                        {rsvp.note ? <p>{rsvp.note}</p> : null}
                      </article>
                    ))}
                  </div>
                ) : (
                  <p>Brak odpowiedzi od gosci.</p>
                )}
              </div>

              <div className="form-card approvals full-width">
                <h3>Pomoc w organizacji urodzin</h3>
                <p>
                  Pierwszy szkic marketplace: lokalne firmy moga byc partnerami aplikacji,
                  a organizator docelowo wybierze uslugi bez wychodzenia z plannera.
                </p>
                <div className="service-grid">
                  {ORGANIZER_SERVICES.map((service) => (
                    <article className="service-card" key={service.title}>
                      <h4>{service.title}</h4>
                      <p>{service.description}</p>
                      <button className="button secondary" type="button">
                        {service.action}
                      </button>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="footer-panel">
        <p>
          {route.isRemote
            ? 'To wydarzenie korzysta z Netlify Functions i Netlify Blobs, wiec rodzice widza wspolna liste.'
            : 'To lokalne demo. Utworz wydarzenie online, zeby zapisac je w Netlify Blobs i dostac linki dla rodzicow.'}
        </p>
        {!route.isRemote ? (
          <button className="button secondary" type="button" onClick={resetDemo}>
            Przywroc dane demo
          </button>
        ) : null}
      </section>
    </main>
  )
}

export default App
