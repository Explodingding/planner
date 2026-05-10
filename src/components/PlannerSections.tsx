import type { FormEvent } from 'react'
import type {
  AttendanceStatus,
  EventDetails,
  Gift,
  PlannerState,
  Reservation,
  ReservationStatus,
  Rsvp,
  VerifiedGuest,
} from '../types'
import { GIFT_CATEGORIES, ORGANIZER_SERVICES } from '../constants'

type RsvpSummary = {
  yes: number
  no: number
  maybe: number
  adults: number
  children: number
}

export function EventSummary({
  childName,
  date,
  place,
  giftCount,
  pendingCount,
  approvedCount,
  confirmedCount,
  isRemote,
  formatDate,
}: {
  childName: string
  date: string
  place: string
  giftCount: number
  pendingCount: number
  approvedCount: number
  confirmedCount: number
  isRemote: boolean
  formatDate: (value: string) => string
}) {
  return (
    <div className="event-card">
      <span className="card-label">{isRemote ? 'Wydarzenie online' : 'Nowe wydarzenie'}</span>
      <h2>{childName ? `Urodziny: ${childName}` : 'Utworz wydarzenie'}</h2>
      <p>{formatDate(date)}</p>
      <p>{place || 'Miejsce do uzupelnienia'}</p>
      <div className="status-row">
        <span>{giftCount} pomysly</span>
        <span>{pendingCount} oczekuje</span>
        <span>{approvedCount} zatwierdzone</span>
        <span>{confirmedCount} potwierdzone</span>
      </div>
    </div>
  )
}

export function SharePanel({
  theme,
  notes,
  publicUrl,
  manageUrl,
  whatsappText,
  onCopy,
}: {
  theme: string
  notes: string
  publicUrl: string
  manageUrl?: string
  whatsappText: string
  onCopy: (value?: string) => void
}) {
  return (
    <section className="grid two-columns">
      <article className="panel">
        <p className="eyebrow">Informacje organizacyjne</p>
        <h2>{theme || 'Szczegoly urodzin'}</h2>
        <p>{notes || 'Organizator uzupelni informacje dla zaproszonych rodzicow.'}</p>
        <div className="share-box">
          <span>Link dla rodzicow</span>
          <code>{publicUrl}</code>
          <div className="inline-actions">
            <button className="button secondary" type="button" onClick={() => onCopy()}>
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
            <button className="button secondary" type="button" onClick={() => onCopy(manageUrl)}>
              Kopiuj link organizatora
            </button>
          </div>
        ) : null}
      </article>

      <article className="panel">
        <p className="eyebrow">Wazne dla gosci</p>
        <h2>Lista gosci jest jawna dla zaproszonych.</h2>
        <p>
          Rodzice widza, kto potwierdzil obecnosc, ale kontakt i prywatne notatki sa
          dostepne tylko w panelu organizatora.
        </p>
      </article>
    </section>
  )
}

export function PublicGuestList({ planner }: { planner: PlannerState }) {
  if (!planner.guestList.length) {
    return (
      <div className="guest-list-public empty">
        <p>
          Organizator nie dodal jeszcze listy zaproszonych albo lista jest otwarta dla wszystkich
          zaproszonych rodzicow.
        </p>
      </div>
    )
  }

  return (
    <ul className="guest-list-public">
      {planner.guestList.map((guest) => (
        <li className="guest-list-item" key={guest.id}>
          <span className="guest-list-name">{guest.name}</span>
        </li>
      ))}
    </ul>
  )
}

export function GiftList({
  planner,
  reservationsByGift,
  getGiftState,
}: {
  planner: PlannerState
  reservationsByGift: Record<string, Reservation[]>
  getGiftState: (giftId: string) => string
}) {
  return (
    <div className="gift-list">
      {planner.gifts.map((gift) => {
        const giftReservations = reservationsByGift[gift.id] ?? []
        const approved = giftReservations.find(
          (reservation) => reservation.status === 'approved' || reservation.status === 'bought',
        )

        return (
          <article className="gift-card" key={gift.id}>
            <div>
              <div className="gift-title-row">
                <h3 className="gift-title">
                  {gift.link ? (
                    <a
                      className="gift-title-link"
                      href={gift.link}
                      rel="noreferrer noopener"
                      target="_blank"
                    >
                      {gift.title}
                    </a>
                  ) : (
                    gift.title
                  )}
                </h3>
                <span className={`pill state-${getGiftState(gift.id)}`}>
                  {getGiftState(gift.id)}
                </span>
              </div>
              <p className="gift-meta">{gift.category}</p>
              {gift.details ? <p>{gift.details}</p> : null}
              {gift.link ? (
                <div className="gift-link-block">
                  <span className="gift-link-block-label">Link do oferty</span>
                  <a
                    className="gift-link-block-url"
                    href={gift.link}
                    rel="noreferrer noopener"
                    target="_blank"
                  >
                    {gift.link}
                  </a>
                </div>
              ) : null}
            </div>
            {approved ? (
              <p className="reservation-note">Zarezerwowane przez: {approved.guestName}</p>
            ) : null}
          </article>
        )
      })}
    </div>
  )
}

export function RsvpSummaryPanel({
  planner,
  rsvpSummary,
}: {
  planner: PlannerState
  rsvpSummary: RsvpSummary
}) {
  return (
    <section className="panel rsvp-overview">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Aktualna lista obecnosci</p>
          <h2>Kto bedzie na wydarzeniu?</h2>
          <p>Ta lista jest jawna dla wszystkich zaproszonych rodzicow.</p>
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
  )
}

export function GuestForms({
  planner,
  verifiedGuest,
  guestName,
  guestContact,
  verificationSent,
  selectedGiftId,
  reservationMessage,
  attendanceStatus,
  attendanceAdults,
  attendanceChildren,
  attendanceNote,
  spamTrap,
  onGuestNameChange,
  onGuestContactChange,
  onSendVerification,
  onConfirmVerification,
  onSelectedGiftChange,
  onReservationMessageChange,
  onAttendanceStatusChange,
  onAttendanceAdultsChange,
  onAttendanceChildrenChange,
  onAttendanceNoteChange,
  onSpamTrapChange,
  onRequestReservation,
  onSubmitRsvp,
}: {
  planner: PlannerState
  verifiedGuest: VerifiedGuest | null
  guestName: string
  guestContact: string
  verificationSent: boolean
  selectedGiftId: string
  reservationMessage: string
  attendanceStatus: AttendanceStatus
  attendanceAdults: number
  attendanceChildren: number
  attendanceNote: string
  spamTrap: string
  onGuestNameChange: (value: string) => void
  onGuestContactChange: (value: string) => void
  onSendVerification: (event: FormEvent<HTMLFormElement>) => void
  onConfirmVerification: () => void
  onSelectedGiftChange: (value: string) => void
  onReservationMessageChange: (value: string) => void
  onAttendanceStatusChange: (value: AttendanceStatus) => void
  onAttendanceAdultsChange: (value: number) => void
  onAttendanceChildrenChange: (value: number) => void
  onAttendanceNoteChange: (value: string) => void
  onSpamTrapChange: (value: string) => void
  onRequestReservation: (event: FormEvent<HTMLFormElement>) => void
  onSubmitRsvp: (event: FormEvent<HTMLFormElement>) => void
}) {
  const usesGuestList = planner.guestList.length > 0
  const listNeedsName = planner.guestList.some((g) => !g.contact?.trim())
  const nameRequired = !usesGuestList || listNeedsName

  const contactField = (
    <label>
      E-mail lub telefon
      <input
        type="text"
        name="guest-contact"
        autoComplete="off"
        inputMode="text"
        enterKeyHint="next"
        value={guestContact}
        onChange={(event) => onGuestContactChange(event.target.value)}
        placeholder="np. anna@example.com lub 500 600 700"
        required
      />
    </label>
  )

  const nameField = (
    <label>
      Imie lub opis
      {nameRequired ? null : <span className="label-optional"> (opcjonalnie)</span>}
      <input
        type="text"
        name="guest-display-name"
        autoComplete="name"
        inputMode="text"
        enterKeyHint="done"
        value={guestName}
        onChange={(event) => onGuestNameChange(event.target.value)}
        placeholder="np. Mama Janka"
        required={nameRequired}
      />
    </label>
  )

  return (
    <div className="grid two-columns reservation-area">
      <form className="form-card" onSubmit={onSendVerification}>
        <h3>1. Potwierdz osobe</h3>
        {usesGuestList ? (
          <p className="form-hint">
            Przy liscie zaproszonych potwierdzamy po <strong>e-mailu lub telefonie</strong> z listy
            organizatora, zeby uniknac pomylek przy wpisywaniu imion.
            {listNeedsName
              ? ' Czesc gosci ma tylko imie na liscie — wtedy dopasujemy po imieniu i kontakcie.'
              : null}
          </p>
        ) : (
          <p className="form-hint">Podaj imie oraz e-mail lub telefon.</p>
        )}
        {usesGuestList ? (
          <>
            {contactField}
            {nameField}
          </>
        ) : (
          <>
            {nameField}
            {contactField}
          </>
        )}
        <label className="spam-field">
          Website
          <input
            autoComplete="off"
            tabIndex={-1}
            value={spamTrap}
            onChange={(event) => onSpamTrapChange(event.target.value)}
          />
        </label>
        <button className="button primary" type="submit">
          Potwierdz dane
        </button>
        {verificationSent ? (
          <div className="verification-box">
            <p>
              Kliknij ponizej, aby zapisac potwierdzenie na podstawie wpisanego kontaktu
              {nameRequired ? ' i imienia' : ''}.
            </p>
            <button className="button secondary" type="button" onClick={onConfirmVerification}>
              Potwierdz tozsamosc
            </button>
          </div>
        ) : null}
      </form>

      <form className="form-card" onSubmit={onRequestReservation}>
        <h3>2. Zglos rezerwacje</h3>
        <label>
          Prezent
          <select
            value={selectedGiftId}
            onChange={(event) => onSelectedGiftChange(event.target.value)}
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
            onChange={(event) => onReservationMessageChange(event.target.value)}
            placeholder="np. Kupie ten prezent razem z paragonem do wymiany."
          />
        </label>
        <button className="button primary" disabled={!verifiedGuest || !planner.gifts.length} type="submit">
          Zglos do zatwierdzenia
        </button>
      </form>

      <form className="form-card" onSubmit={onSubmitRsvp}>
        <h3>3. Potwierdz obecnosc</h3>
        <label>
          Czy bedziecie?
          <select
            value={attendanceStatus}
            onChange={(event) => onAttendanceStatusChange(event.target.value as AttendanceStatus)}
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
              onChange={(event) => onAttendanceAdultsChange(Number(event.target.value))}
            />
          </label>
          <label>
            Dzieci
            <input
              min="0"
              type="number"
              value={attendanceChildren}
              onChange={(event) => onAttendanceChildrenChange(Number(event.target.value))}
            />
          </label>
        </div>
        <label>
          Notatka dla organizatora
          <textarea
            value={attendanceNote}
            onChange={(event) => onAttendanceNoteChange(event.target.value)}
            placeholder="np. Przyjdziemy we dwoje, ale mozemy sie spoznic 15 minut."
          />
        </label>
        <button className="button primary" disabled={!verifiedGuest} type="submit">
          Zapisz obecnosc
        </button>
      </form>
    </div>
  )
}

export type OrganizerPanelSections = {
  eventDetails: boolean
  guestList: boolean
  addGift: boolean
  pending: boolean
  approved: boolean
  privateRsvps: boolean
}

const defaultOrganizerSections: OrganizerPanelSections = {
  eventDetails: true,
  guestList: true,
  addGift: true,
  pending: true,
  approved: true,
  privateRsvps: true,
}

export function OrganizerPanel({
  planner,
  newGift,
  pendingReservations,
  approvedReservations,
  isRemote,
  onEventChange,
  onSaveEventDetails,
  guestListText,
  onGuestListTextChange,
  onSaveGuestList,
  onNewGiftChange,
  onAddGift,
  onReservationStatusChange,
  sections = defaultOrganizerSections,
}: {
  planner: PlannerState
  newGift: Omit<Gift, 'id'>
  pendingReservations: Reservation[]
  approvedReservations: Reservation[]
  isRemote: boolean
  onEventChange: (field: keyof EventDetails, value: string) => void
  onSaveEventDetails: (event: FormEvent<HTMLFormElement>) => void
  guestListText: string
  onGuestListTextChange: (value: string) => void
  onSaveGuestList: (event: FormEvent<HTMLFormElement>) => void
  onNewGiftChange: (gift: Omit<Gift, 'id'>) => void
  onAddGift: (event: FormEvent<HTMLFormElement>) => void
  onReservationStatusChange: (reservationId: string, status: ReservationStatus) => void
  sections?: Partial<OrganizerPanelSections>
}) {
  const show: OrganizerPanelSections = { ...defaultOrganizerSections, ...sections }

  return (
    <div className="organizer-grid">
      {show.eventDetails ? (
      <form className="form-card" onSubmit={onSaveEventDetails}>
        <h3>Szczegoly wydarzenia</h3>
        <label>
          Imie dziecka
          <input
            value={planner.event.childName}
            onChange={(event) => onEventChange('childName', event.target.value)}
            required
          />
        </label>
        <label>
          Data i godzina
          <input
            type="datetime-local"
            value={planner.event.date}
            onChange={(event) => onEventChange('date', event.target.value)}
            required
          />
        </label>
        <label>
          Miejsce
          <input
            value={planner.event.place}
            onChange={(event) => onEventChange('place', event.target.value)}
            required
          />
        </label>
        <label>
          Temat / krotki opis
          <input
            value={planner.event.theme}
            onChange={(event) => onEventChange('theme', event.target.value)}
          />
        </label>
        <label>
          Preferencje i informacje organizacyjne
          <textarea
            value={planner.event.notes}
            onChange={(event) => onEventChange('notes', event.target.value)}
          />
        </label>
        {isRemote ? (
          <button className="button primary" type="submit">
            Zapisz szczegoly online
          </button>
        ) : null}
      </form>
      ) : null}

      {show.guestList ? (
      <form className="form-card guest-list-card" onSubmit={onSaveGuestList}>
        <h3>Lista zaproszonych gosci</h3>
        <p className="form-hint">
          Wklej wiele osob naraz, po jednej w linii. Format: imie/opis, kontakt.
          Kontakt moze byc pusty.
        </p>
        <label>
          Goscie
          <textarea
            value={guestListText}
            onChange={(event) => onGuestListTextChange(event.target.value)}
            placeholder={'Mama Janka, mama.janka@example.com\nTata Zosi, 500600700\nRodzice Franka'}
          />
        </label>
        <p className="form-hint">
          Dodano {planner.guestList.length} pozycji. Jesli lista jest pusta, rodzice moga
          potwierdzac sie tak jak dotychczas.
        </p>
        <button className="button primary" type="submit">
          {isRemote ? 'Zapisz liste gosci online' : 'Zastosuj liste gosci'}
        </button>
      </form>
      ) : null}

      {show.addGift ? (
      <form className="form-card" onSubmit={onAddGift}>
        <h3>Dodaj prezent</h3>
        <label>
          Nazwa
          <input
            value={newGift.title}
            onChange={(event) => onNewGiftChange({ ...newGift, title: event.target.value })}
            placeholder="np. Gra planszowa"
          />
        </label>
        <label>
          Kategoria
          <select
            value={newGift.category}
            onChange={(event) => onNewGiftChange({ ...newGift, category: event.target.value })}
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
            onChange={(event) => onNewGiftChange({ ...newGift, details: event.target.value })}
            placeholder="Co warto wiedziec przed zakupem?"
          />
        </label>
        <label>
          Link do oferty (opcjonalnie)
          <input
            type="url"
            inputMode="url"
            value={newGift.link}
            onChange={(event) => onNewGiftChange({ ...newGift, link: event.target.value })}
            placeholder="https://allegro.pl/oferta/..."
          />
        </label>
        <button className="button primary" type="submit">
          Dodaj do listy
        </button>
      </form>
      ) : null}

      {show.pending ? (
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
                    onClick={() => onReservationStatusChange(reservation.id, 'approved')}
                  >
                    Zatwierdz
                  </button>
                  <button
                    className="button secondary"
                    type="button"
                    onClick={() => onReservationStatusChange(reservation.id, 'rejected')}
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
      ) : null}

      {show.approved ? (
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
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => onReservationStatusChange(reservation.id, 'bought')}
                >
                  Oznacz jako kupiony
                </button>
              </article>
            )
          })
        ) : (
          <p>Jeszcze nie ma zatwierdzonych rezerwacji.</p>
        )}
      </div>
      ) : null}

      {show.privateRsvps ? (
      <div className="form-card approvals full-width">
        <h3>Lista obecnosci</h3>
        {planner.rsvps.length ? (
          <div className="rsvp-list">
            {planner.rsvps.map((rsvp) => (
              <PrivateRsvpCard key={rsvp.id} rsvp={rsvp} />
            ))}
          </div>
        ) : (
          <p>Brak odpowiedzi od gosci.</p>
        )}
      </div>
      ) : null}
    </div>
  )
}

function PrivateRsvpCard({ rsvp }: { rsvp: Rsvp }) {
  return (
    <article className="approval-card">
      <p className={`pill attendance-${rsvp.status}`}>
        {rsvp.status === 'yes' ? 'bedziemy' : rsvp.status === 'maybe' ? 'nie wiem' : 'nie bedzie nas'}
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
  )
}

export function PartnerServices() {
  return (
    <div className="form-card approvals full-width">
      <h3>Pomoc w organizacji urodzin</h3>
      <p>
        Pierwszy szkic marketplace: lokalne firmy moga byc partnerami aplikacji, a
        organizator docelowo wybierze uslugi bez wychodzenia z plannera.
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
  )
}
