import { type FormEvent, useEffect, useMemo, useState } from 'react'
import './App.css'

type ReservationStatus = 'pending' | 'approved' | 'rejected' | 'bought'
type AttendanceStatus = 'yes' | 'no' | 'maybe'

type EventDetails = {
  childName: string
  date: string
  place: string
  theme: string
  notes: string
}

type Gift = {
  id: string
  title: string
  category: string
  details: string
  priceHint: string
}

type Reservation = {
  id: string
  giftId: string
  guestName: string
  contact: string
  message: string
  status: ReservationStatus
  createdAt: string
}

type Rsvp = {
  id: string
  guestName: string
  contact: string
  status: AttendanceStatus
  adults: number
  children: number
  note: string
  updatedAt: string
}

type PlannerState = {
  event: EventDetails
  gifts: Gift[]
  reservations: Reservation[]
  rsvps: Rsvp[]
}

type VerifiedGuest = {
  name: string
  contact: string
}

const STORAGE_KEY = 'prezentownik-mvp'

const initialState: PlannerState = {
  event: {
    childName: 'Tosia',
    date: '2026-05-24T15:00',
    place: 'Sala zabaw Kolorowe Klocki, Warszawa',
    theme: 'Urodziny w klimacie zwierzakow i klockow',
    notes:
      'Tosia lubi LEGO Friends, puzzle, kredki i ksiazki o zwierzetach. Prosimy unikac pluszakow, bo mamy ich juz bardzo duzo.',
  },
  gifts: [
    {
      id: 'gift-lego',
      title: 'Zestaw LEGO Friends',
      category: 'Klocki',
      details: 'Najlepiej maly lub sredni zestaw ze zwierzakami albo domkiem.',
      priceHint: '60-120 zl',
    },
    {
      id: 'gift-book',
      title: 'Ksiazka o zwierzetach',
      category: 'Ksiazki',
      details: 'Ilustrowana, dla dzieci 5-6 lat.',
      priceHint: '30-60 zl',
    },
    {
      id: 'gift-art',
      title: 'Porzadne kredki lub flamastry',
      category: 'Kreatywne',
      details: 'Zestaw do rysowania, najlepiej zmywalny.',
      priceHint: '40-80 zl',
    },
  ],
  reservations: [
    {
      id: 'reservation-demo',
      giftId: 'gift-book',
      guestName: 'Mama Janka',
      contact: 'mama.janka@example.com',
      message: 'Moge kupic ksiazke i dorzuce kartke od Janka.',
      status: 'pending',
      createdAt: new Date().toISOString(),
    },
  ],
  rsvps: [
    {
      id: 'rsvp-demo-yes',
      guestName: 'Mama Janka',
      contact: 'mama.janka@example.com',
      status: 'yes',
      adults: 1,
      children: 1,
      note: 'Janek bedzie, dziekujemy za zaproszenie.',
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'rsvp-demo-maybe',
      guestName: 'Rodzice Hani',
      contact: 'hania@example.com',
      status: 'maybe',
      adults: 1,
      children: 1,
      note: 'Potwierdzimy po weekendzie.',
      updatedAt: new Date().toISOString(),
    },
  ],
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

function App() {
  const [planner, setPlanner] = useState<PlannerState>(loadPlannerState)
  const [isOrganizer, setIsOrganizer] = useState(true)
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
    category: '',
    details: '',
    priceHint: '',
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(planner))
  }, [planner])

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

  const shareUrl = typeof window === 'undefined' ? '' : window.location.href
  const whatsappText = encodeURIComponent(
    `Czesc! Tu lista prezentow na urodziny: ${planner.event.childName}. Mozesz zobaczyc pomysly i zglosic rezerwacje tutaj: ${shareUrl}`,
  )

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

  function addGift(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!newGift.title.trim()) return

    const gift: Gift = {
      id: createId('gift'),
      title: newGift.title.trim(),
      category: newGift.category.trim() || 'Inne',
      details: newGift.details.trim(),
      priceHint: newGift.priceHint.trim(),
    }

    setPlanner((current) => ({
      ...current,
      gifts: [...current.gifts, gift],
    }))
    setNewGift({ title: '', category: '', details: '', priceHint: '' })
    setSelectedGiftId(gift.id)
  }

  function requestReservation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!verifiedGuest || !selectedGiftId) return

    const reservation: Reservation = {
      id: createId('reservation'),
      giftId: selectedGiftId,
      guestName: verifiedGuest.name,
      contact: verifiedGuest.contact,
      message: reservationMessage.trim(),
      status: 'pending',
      createdAt: new Date().toISOString(),
    }

    setPlanner((current) => ({
      ...current,
      reservations: [...current.reservations, reservation],
    }))
    setReservationMessage('')
  }

  function submitRsvp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!verifiedGuest) return

    const now = new Date().toISOString()

    setPlanner((current) => {
      const existing = current.rsvps.find((rsvp) => rsvp.contact === verifiedGuest.contact)
      const nextRsvp: Rsvp = {
        id: existing?.id ?? createId('rsvp'),
        guestName: verifiedGuest.name,
        contact: verifiedGuest.contact,
        status: attendanceStatus,
        adults: attendanceStatus === 'yes' ? Math.max(0, attendanceAdults) : 0,
        children: attendanceStatus === 'yes' ? Math.max(0, attendanceChildren) : 0,
        note: attendanceNote.trim(),
        updatedAt: now,
      }

      return {
        ...current,
        rsvps: existing
          ? current.rsvps.map((rsvp) => (rsvp.id === existing.id ? nextRsvp : rsvp))
          : [...current.rsvps, nextRsvp],
      }
    })
    setAttendanceNote('')
  }

  function updateReservationStatus(reservationId: string, status: ReservationStatus) {
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
  }

  async function copyShareLink() {
    await navigator.clipboard.writeText(shareUrl)
  }

  return (
    <main className="app-shell">
      <section className="hero-section">
        <div className="hero-copy">
          <p className="eyebrow">Prezentownik MVP</p>
          <h1>Prosty planner prezentow i urodzin dla grupy rodzicow.</h1>
          <p>
            Organizator opisuje wydarzenie i pomysly na prezenty, rodzice potwierdzaja
            tozsamosc, a rezerwacje trafiaja do zatwierdzenia.
          </p>
          <div className="hero-actions">
            <a className="button primary" href="#guest">
              Zglos rezerwacje
            </a>
            <a className="button secondary" href="#organizer">
              Panel organizatora
            </a>
          </div>
        </div>
        <div className="event-card">
          <span className="card-label">Najblizsze wydarzenie</span>
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
            <code>{shareUrl}</code>
            <div className="inline-actions">
              <button className="button secondary" type="button" onClick={copyShareLink}>
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
        </article>

        <article className="panel">
          <p className="eyebrow">Zakres MVP</p>
          <h2>Najpierw jeden problem: kto co kupuje.</h2>
          <p>
            Do listy prezentow dodajemy tez RSVP, czyli potwierdzenie obecnosci. To nadal
            prosty planner urodzinowy, ale organizator widzi juz aktualna liste gosci.
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
      </section>

      <section className="panel" id="guest">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Widok rodzica</p>
            <h2>Lista prezentow</h2>
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
                  <p className="gift-meta">
                    {gift.category}
                    {gift.priceHint ? ` · ${gift.priceHint}` : ''}
                  </p>
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

      <section className="panel organizer-panel" id="organizer">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Panel organizatora</p>
            <h2>Zarzadzanie wydarzeniem</h2>
          </div>
          <button
            className="button secondary"
            type="button"
            onClick={() => setIsOrganizer((value) => !value)}
          >
            {isOrganizer ? 'Ukryj panel' : 'Pokaz panel'}
          </button>
        </div>

        {isOrganizer ? (
          <div className="organizer-grid">
            <form className="form-card">
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
                <input
                  value={newGift.category}
                  onChange={(event) => setNewGift({ ...newGift, category: event.target.value })}
                  placeholder="np. Gry"
                />
              </label>
              <label>
                Szczegoly
                <textarea
                  value={newGift.details}
                  onChange={(event) => setNewGift({ ...newGift, details: event.target.value })}
                  placeholder="Co warto wiedziec przed zakupem?"
                />
              </label>
              <label>
                Budzet orientacyjny
                <input
                  value={newGift.priceHint}
                  onChange={(event) => setNewGift({ ...newGift, priceHint: event.target.value })}
                  placeholder="np. 50-90 zl"
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
          </div>
        ) : null}
      </section>

      <section className="footer-panel">
        <p>
          Dane sa teraz zapisywane lokalnie w przegladarce. Projekt jest przygotowany pod
          wdrozenie na Netlify; wspolna lista dla wielu osob wymaga kolejnego kroku:
          Netlify Functions i trwalego magazynu danych.
        </p>
        <button className="button secondary" type="button" onClick={resetDemo}>
          Przywroc dane demo
        </button>
      </section>
    </main>
  )
}

export default App
