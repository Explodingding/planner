import { type FormEvent, useEffect, useMemo, useState } from 'react'
import heroImg from './assets/hero.png'
import { emptyPlanner, initialState } from './demoData'
import { track } from './analytics'
import { GiftIdeasGuide } from './components/GiftIdeasGuide'
import { PrivacyPage, TermsPage } from './components/LegalPages'
import { SuggestionForm } from './components/SuggestionForm'
import {
  EventSummary,
  GiftList,
  GuestForms,
  OrganizerPanel,
  PartnerServices,
  PublicGuestList,
  RsvpSummaryPanel,
  SharePanel,
} from './components/PlannerSections'
import type {
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
import { API_URL, callEventApi, parseApiResponse, readApiResponse } from './lib/api'
import {
  CHECKOUT_ORGANIZER_KEY,
  DRAFT_STORAGE_KEY,
  createId,
  digitsOnly,
  formatDate,
  loadPlannerDraft,
  phonesMatch,
  sanitizeGuestListForApi,
} from './lib/planner'
import { getRoute } from './lib/route'
import './App.css'

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

type RemoteTabId = 'info' | 'guests' | 'gifts' | 'help' | 'organizer'
type CreateTabId = 'setup' | 'guests' | 'gifts' | 'help'

function App() {
  const [route] = useState(getRoute)
  const [planner, setPlanner] = useState<PlannerState>(loadPlannerDraft)
  const [eventRecord, setEventRecord] = useState<PublicEventRecord | null>(null)
  const [createTab, setCreateTab] = useState<CreateTabId>('setup')
  const [remoteTab, setRemoteTab] = useState<RemoteTabId>(() =>
    route.isManageRoute ? 'organizer' : 'info',
  )
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
  const [newGift, setNewGift] = useState<Omit<Gift, 'id'>>({
    title: '',
    category: GIFT_CATEGORIES[0],
    details: '',
    link: '',
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
        setSelectedGiftId(event.planner.gifts[0]?.id ?? '')
        setApiError('')
        track(route.isManageRoute ? 'manage_view' : 'event_view')
      })
      .catch((error: Error) => setApiError(error.message))
      .finally(() => setIsLoading(false))
  }, [route.eventId, route.organizerToken, route.isManageRoute])

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
    setCreateValidationErrors([])
  }

  useEffect(() => {
    if (route.isRemote) return

    queueMicrotask(() => {
      const params = new URLSearchParams(window.location.search)
      const checkout = params.get('eventCheckout')

      if (checkout === 'cancel') {
        track('checkout_cancel')
        window.history.replaceState({}, '', window.location.pathname)
        setApiMessage('')
        setApiError('Platnosc zostala anulowana. Sprobuj ponownie.')
        return
      }

      if (checkout !== 'success') return

      const sessionId = params.get('session_id')
      if (!sessionId) return

      const doneKey = `event-checkout-done-${sessionId}`
      if (sessionStorage.getItem(doneKey)) {
        window.history.replaceState({}, '', window.location.pathname)
        return
      }

      const inflightKey = `event-checkout-inflight-${sessionId}`
      if (sessionStorage.getItem(inflightKey)) return
      sessionStorage.setItem(inflightKey, '1')
      track('checkout_success_return')

      // Szkic wydarzenia i dane organizatora sa odtwarzane ze snapshotu na serwerze
      // (zapisanego przed platnoscia) — powrot dziala nawet po wyczyszczeniu przegladarki.
      void (async () => {
        try {
          setApiMessage('Tworze wydarzenie online...')
          setApiError('')
          const event = await callEventApi({
            action: 'create',
            stripeCheckoutSessionId: sessionId,
            spamTrap: '',
          })

          track('create_ok')
          sessionStorage.setItem(doneKey, '1')
          sessionStorage.removeItem(inflightKey)
          localStorage.removeItem(CHECKOUT_ORGANIZER_KEY)
          localStorage.removeItem(DRAFT_STORAGE_KEY)
          window.history.replaceState({}, '', window.location.pathname)

          if (event.manageUrl) {
            window.location.href = event.manageUrl
            return
          }

          applyRemoteEvent(event, 'Utworzono wydarzenie online.')
        } catch (error) {
          track('create_fail')
          setApiMessage('')
          setApiError((error as Error).message)
          sessionStorage.removeItem(inflightKey)
        }
      })()
    })
  }, [route.isRemote])

  async function persistManagedAction(body: ManagedActionPayload, successMessage = 'Zapisano zmiany online.') {
    if (!route.eventId || !route.organizerToken) {
      throw new Error('Do zapisu zmian potrzebny jest prywatny link organizatora z tokenem.')
    }

    const event = await callEventApi({
      ...body,
      id: route.eventId,
      token: route.organizerToken,
    } as EventApiRequest)

    applyRemoteEvent(event, successMessage)
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

  function updateGuestListFromEditor(next: Guest[]) {
    setCreateValidationErrors([])
    setPlanner((current) => ({ ...current, guestList: next }))
  }

  async function saveGuestList(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const guestList = sanitizeGuestListForApi(planner.guestList)

    if (!route.isRemote) {
      setApiMessage('Lista gosci zostanie zapisana przy tworzeniu wydarzenia online.')
      setApiError('')
      return
    }

    if (!route.organizerToken) {
      setApiMessage('')
      setApiError('Liste gosci mozna zapisac tylko z prywatnego linku organizatora.')
      return
    }

    try {
      setApiMessage('Zapisuje liste gosci online...')
      setApiError('')
      await persistManagedAction({ action: 'updateGuestList', guestList })
    } catch (error) {
      setApiMessage('')
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
    const hasGuestList = planner.guestList.length > 0

    if (!guestContact.trim()) return
    if (!hasGuestList && !guestName.trim()) return

    setVerificationSent(true)
  }

  function confirmVerification() {
    const guestList = planner.guestList
    const contactInput = guestContact.trim()

    if (!contactInput) {
      setApiMessage('')
      setApiError(
        guestList.length ? 'Podaj numer telefonu z listy.' : 'Podaj adres e-mail lub numer telefonu.',
      )
      return
    }

    if (!guestList.length) {
      if (!guestName.trim()) {
        setApiMessage('')
        setApiError('Podaj takze imie lub opis.')
        return
      }
      setVerifiedGuest({
        name: guestName.trim(),
        contact: contactInput,
      })
      setApiError('')
      return
    }

    if (digitsOnly(contactInput).length < 9) {
      setApiMessage('')
      setApiError('Podaj numer telefonu z listy (min. 9 cyfr).')
      return
    }

    const listedGuest = guestList.find((guest) => phonesMatch(guest.contact, contactInput))

    if (!listedGuest) {
      setApiMessage('')
      setApiError(
        'Nie znalezlismy tego numeru na liscie gosci. Sprawdz wpis albo skontaktuj sie z organizatorem.',
      )
      return
    }

    setVerifiedGuest({
      name: listedGuest.name,
      contact: listedGuest.contact?.trim() || contactInput,
    })
    setApiError('')
  }

  async function startPaidOnlineEventCreation() {
    if (!validateCreateOnlineEvent()) return

    try {
      setApiMessage('Przekierowanie do bezpiecznej platnosci (Stripe)...')
      setApiError('')
      track('checkout_start')
      // Szkic + dane organizatora ida na serwer przed platnoscia (walidacja przed pobraniem oplaty,
      // odpornosc na wyczyszczenie localStorage miedzy platnoscia a powrotem).
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'createEventCheckout',
          planner: {
            ...planner,
            guestList: sanitizeGuestListForApi(planner.guestList),
          },
          organizerName: organizerName.trim(),
          organizerContact: organizerContact.trim(),
          spamTrap,
        }),
      })
      const body = await parseApiResponse(response)
      if (!body.checkoutUrl) throw new Error('Brak adresu platnosci w odpowiedzi serwera.')
      setSpamTrap('')
      window.location.assign(body.checkoutUrl)
    } catch (error) {
      setApiMessage('')
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
      link: newGift.link.trim(),
    }

    if (route.isRemote) {
      try {
        await persistManagedAction({ action: 'addGift', gift })
        setNewGift({ title: '', category: GIFT_CATEGORIES[0], details: '', link: '' })
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
    setNewGift({ title: '', category: GIFT_CATEGORIES[0], details: '', link: '' })
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
      track('reserve_ok')
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
      track('rsvp_ok')
      applyRemoteEvent(remoteEvent, 'Potwierdzenie obecnosci zapisane.')
      setAttendanceNote('')
    } catch (error) {
      setApiError((error as Error).message)
    }
  }

  async function updateReservationStatus(reservationId: string, status: ReservationStatus) {
    if (!route.isRemote) return

    const statusMessages: Partial<Record<ReservationStatus, string>> = {
      bought: 'Prezent oznaczony jako kupiony.',
      approved: 'Rezerwacja zatwierdzona.',
      rejected: 'Rezerwacja odrzucona.',
    }

    try {
      await persistManagedAction(
        { action: 'updateReservationStatus', reservationId, status },
        statusMessages[status] ?? 'Zapisano zmiany online.',
      )
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          document.getElementById('app-status-message')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        })
      })
    } catch (error) {
      setApiError((error as Error).message)
    }
  }

  function loadDemoData() {
    setPlanner(initialState)
    setApiMessage('Wczytano dane przykladowe do wersji roboczej.')
    setApiError('')
  }

  function resetDraft() {
    setPlanner(emptyPlanner)
    setApiMessage('')
    setApiError('')
    localStorage.removeItem(DRAFT_STORAGE_KEY)
  }

  async function copyShareLink(value = publicUrl) {
    await navigator.clipboard.writeText(value)
    setApiMessage('Skopiowano link.')
  }

  if (route.staticPage === 'regulamin') return <TermsPage />
  if (route.staticPage === 'prywatnosc') return <PrivacyPage />

  if (isLoading) {
    return (
      <main className="app-shell">
        <section className="panel glass-panel">
          <p className="eyebrow">Prezentownik</p>
          <h1>Laduje wydarzenie...</h1>
        </section>
      </main>
    )
  }

  const createTabs: { id: CreateTabId; label: string }[] = [
    { id: 'setup', label: 'Start' },
    { id: 'guests', label: 'Lista gosci' },
    { id: 'gifts', label: 'Prezenty' },
    { id: 'help', label: 'Pomoc' },
  ]

  const effectiveRemoteTab: RemoteTabId =
    !canManage && remoteTab === 'organizer' ? 'info' : remoteTab

  const remoteTabs: { id: RemoteTabId; label: string }[] = [
    { id: 'info', label: 'Impreza' },
    { id: 'guests', label: 'Goscie' },
    { id: 'gifts', label: 'Prezenty' },
    { id: 'help', label: 'Pomoc' },
    ...(canManage ? ([{ id: 'organizer' as const, label: 'Organizator' }] as const) : []),
  ]

  return (
    <main className={`app-shell${route.isRemote ? '' : ' app-shell--create'}`}>
      <header className="app-topbar glass-panel">
        <div className="app-brand">
          <span className="app-logo" aria-hidden>
            🎁
          </span>
          <div>
            <p className="app-brand-title">Prezentownik</p>
            <p className="app-brand-sub">
              {route.isRemote
                ? planner.event.childName
                  ? `Urodziny: ${planner.event.childName}`
                  : 'Wspolna lista i obecnosc'
                : 'Nowe wydarzenie'}
            </p>
          </div>
        </div>
        <nav className="app-tabs" role="tablist" aria-label="Nawigacja sekcji">
          {(route.isRemote ? remoteTabs : createTabs).map((tab) => {
            const isActive = route.isRemote
              ? effectiveRemoteTab === tab.id
              : createTab === tab.id

            return (
            <button
              key={tab.id}
              id={`tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`app-tab${isActive ? ' is-active' : ''}`}
              onClick={() =>
                route.isRemote
                  ? setRemoteTab(tab.id as RemoteTabId)
                  : setCreateTab(tab.id as CreateTabId)
              }
            >
              {tab.label}
            </button>
            )
          })}
        </nav>
      </header>

      <section className="hero-strip glass-panel">
        <img src={heroImg} className="hero-decoration" aria-hidden alt="" />
        <div className="hero-strip-copy">
          <p className="eyebrow">{route.isRemote ? 'Wydarzenie online' : 'Tworzenie wydarzenia'}</p>
          <h1 className="hero-strip-title">
            {route.isRemote
              ? 'Lista prezentow, gosci i szczegoly imprezy w jednym miejscu.'
              : 'Urodziny bez chaosu: lista, goscie i link dla rodzicow.'}
          </h1>
          <p className="hero-strip-lead">
            {route.isRemote
              ? 'Dane sa wspoldzielone przez Netlify Blobs. Uzyj zakladek powyzej, aby przejsc miedzy sekcjami.'
              : 'Uzupelnij zakladki po kolei. Utworzenie wydarzenia online kosztuje jednorazowo 5 zl (Stripe), potem otrzymasz linki.'}
          </p>
          <div className="hero-actions">
            {route.isRemote ? (
              <button className="button primary" type="button" onClick={() => setRemoteTab('gifts')}>
                Zobacz prezenty
              </button>
            ) : (
              <button className="button primary" type="button" onClick={startPaidOnlineEventCreation}>
                Zaplac 5 zl i utworz wydarzenie
              </button>
            )}
            {route.isRemote && canManage ? (
              <button
                className="button secondary"
                type="button"
                onClick={() => setRemoteTab('organizer')}
              >
                Panel organizatora
              </button>
            ) : null}
            {!route.isRemote ? (
              <button className="button secondary" type="button" onClick={loadDemoData}>
                Wczytaj przyklad
              </button>
            ) : null}
          </div>
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

      {apiMessage ? (
        <p className="status-message" id="app-status-message" role="status" aria-live="polite">
          {apiMessage}
        </p>
      ) : null}
      {apiError ? <p className="error-message">{apiError}</p> : null}

      {!route.isRemote ? (
        <div className="tab-panel-stack">
          {createTab === 'setup' ? (
            <section
              className="panel glass-panel organizer-panel"
              role="tabpanel"
              aria-labelledby={`tab-${createTab}`}
            >
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Krok 1</p>
                  <h2>Organizator i szczegoly urodzin</h2>
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
                onGuestListChange={updateGuestListFromEditor}
                onSaveGuestList={saveGuestList}
                onNewGiftChange={setNewGift}
                onAddGift={addGift}
                onReservationStatusChange={updateReservationStatus}
                sections={{
                  guestList: false,
                  addGift: false,
                  pending: false,
                  approved: false,
                  privateRsvps: false,
                }}
              />
              <div className="hero-actions">
                <button className="button primary" type="button" onClick={startPaidOnlineEventCreation}>
                  Zaplac 5 zl i utworz wydarzenie
                </button>
                <button className="button secondary" type="button" onClick={resetDraft}>
                  Wyczysc wersje robocza
                </button>
              </div>
            </section>
          ) : null}

          {createTab === 'guests' ? (
            <section
              className="panel glass-panel"
              role="tabpanel"
              aria-labelledby={`tab-${createTab}`}
            >
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Krok 2</p>
                  <h2>Lista zaproszonych</h2>
                  <p>Dodaj gosci w tabeli (nazwa i telefon). Mozesz tez zostawic liste pusta.</p>
                </div>
              </div>
              <OrganizerPanel
                planner={planner}
                newGift={newGift}
                pendingReservations={[]}
                approvedReservations={[]}
                isRemote={false}
                onEventChange={updateEvent}
                onSaveEventDetails={(event) => event.preventDefault()}
                onGuestListChange={updateGuestListFromEditor}
                onSaveGuestList={saveGuestList}
                onNewGiftChange={setNewGift}
                onAddGift={addGift}
                onReservationStatusChange={updateReservationStatus}
                sections={{
                  eventDetails: false,
                  addGift: false,
                  pending: false,
                  approved: false,
                  privateRsvps: false,
                }}
              />
            </section>
          ) : null}

          {createTab === 'gifts' ? (
            <section
              className="panel glass-panel"
              role="tabpanel"
              aria-labelledby={`tab-${createTab}`}
            >
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Krok 3</p>
                  <h2>Pomysly na prezenty</h2>
                  <p>Dodaj pierwsze pozycje, rodzice zobacza je na publicznym linku.</p>
                </div>
              </div>
              <GiftIdeasGuide event={planner.event} />
              {planner.gifts.length ? (
                <GiftList
                  planner={planner}
                  reservationsByGift={reservationsByGift}
                  getGiftState={getGiftState}
                />
              ) : (
                <p className="empty-tab-hint">Jeszcze brak prezentow na liscie.</p>
              )}
              <OrganizerPanel
                planner={planner}
                newGift={newGift}
                pendingReservations={[]}
                approvedReservations={[]}
                isRemote={false}
                onEventChange={updateEvent}
                onSaveEventDetails={(event) => event.preventDefault()}
                onGuestListChange={updateGuestListFromEditor}
                onSaveGuestList={saveGuestList}
                onNewGiftChange={setNewGift}
                onAddGift={addGift}
                onReservationStatusChange={updateReservationStatus}
                sections={{
                  eventDetails: false,
                  guestList: false,
                  pending: false,
                  approved: false,
                  privateRsvps: false,
                }}
              />
            </section>
          ) : null}

          {createTab === 'help' ? (
            <section
              className="panel glass-panel"
              role="tabpanel"
              aria-labelledby={`tab-${createTab}`}
            >
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Dodatkowo</p>
                  <h2>Pomoc w organizacji urodzin</h2>
                </div>
              </div>
              <PartnerServices />
            </section>
          ) : null}
        </div>
      ) : (
        <div className="tab-panel-stack">
          {effectiveRemoteTab === 'info' ? (
            <div
              className="tab-panel"
              role="tabpanel"
              aria-labelledby={`tab-${effectiveRemoteTab}`}
            >
              <SharePanel
                theme={planner.event.theme}
                notes={planner.event.notes}
                publicUrl={publicUrl}
                manageUrl={manageUrl}
                whatsappText={whatsappText}
                onCopy={copyShareLink}
              />
            </div>
          ) : null}

          {effectiveRemoteTab === 'guests' ? (
            <section
              className="panel glass-panel tab-panel"
              role="tabpanel"
              aria-labelledby={`tab-${effectiveRemoteTab}`}
            >
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Goscie</p>
                  <h2>Lista zaproszonych i obecnosc</h2>
                  <p>Imiona z listy sa widoczne dla zaproszonych. Numery telefonow pokazujemy w przyblizeniu (ostatnie cyfry); pelne numery widzi tylko organizator.</p>
                </div>
                {verifiedGuest ? (
                  <span className="pill success">Zalogowano jako {verifiedGuest.name}</span>
                ) : (
                  <span className="pill">Wymagane potwierdzenie</span>
                )}
              </div>
              <h3 className="tab-subheading">Zaproszeni</h3>
              <PublicGuestList planner={planner} />
              <RsvpSummaryPanel planner={planner} rsvpSummary={rsvpSummary} />
              <h3 className="tab-subheading">Twoje dzialania</h3>
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
          ) : null}

          {effectiveRemoteTab === 'gifts' ? (
            <section
              className="panel glass-panel tab-panel"
              role="tabpanel"
              aria-labelledby={`tab-${effectiveRemoteTab}`}
            >
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Prezenty</p>
                  <h2>Lista pomyslow na prezent</h2>
                  <p>Po potwierdzeniu osoby mozesz zglosic rezerwacje w zakladce Goscie.</p>
                </div>
              </div>
              <GiftIdeasGuide event={planner.event} />
              {planner.gifts.length ? (
                <GiftList
                  planner={planner}
                  reservationsByGift={reservationsByGift}
                  getGiftState={getGiftState}
                />
              ) : (
                <p className="empty-tab-hint">Organizator jeszcze nie dodal pomyslow na prezenty.</p>
              )}
            </section>
          ) : null}

          {effectiveRemoteTab === 'help' ? (
            <section
              className="panel glass-panel tab-panel"
              role="tabpanel"
              aria-labelledby={`tab-${effectiveRemoteTab}`}
            >
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Partnerzy</p>
                  <h2>Pomoc w organizacji urodzin</h2>
                </div>
              </div>
              <PartnerServices />
            </section>
          ) : null}

          {effectiveRemoteTab === 'organizer' && canManage ? (
            <section
              className="panel glass-panel organizer-panel tab-panel"
              role="tabpanel"
              aria-labelledby="tab-organizer"
              id="organizer"
            >
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Prywatny panel</p>
                  <h2>Zarzadzanie wydarzeniem</h2>
                  <p>Ta zakladka jest dostepna tylko z linku organizatora z tokenem.</p>
                </div>
              </div>
              <OrganizerPanel
                planner={planner}
                newGift={newGift}
                pendingReservations={pendingReservations}
                approvedReservations={approvedReservations}
                isRemote={route.isRemote}
                onEventChange={updateEvent}
                onSaveEventDetails={saveEventDetails}
                onGuestListChange={updateGuestListFromEditor}
                onSaveGuestList={saveGuestList}
                onNewGiftChange={setNewGift}
                onAddGift={addGift}
                onReservationStatusChange={updateReservationStatus}
              />
            </section>
          ) : null}
        </div>
      )}

      <section className="footer-panel glass-panel footer-panel--with-form">
        <p className="footer-panel-note">
          {route.isRemote
            ? 'Dane wydarzenia: Netlify Functions + Netlify Blobs.'
            : 'Po utworzeniu wydarzenia otrzymasz linki do udostepnienia i zarzadzania.'}
        </p>
        <SuggestionForm />
        <p className="footer-legal">
          <a href="/regulamin">Regulamin</a> · <a href="/prywatnosc">Polityka prywatności</a>
        </p>
      </section>
    </main>
  )
}

export default App
