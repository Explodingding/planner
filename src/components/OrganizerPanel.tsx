import type { FormEvent } from 'react'
import type {
  EventDetails,
  Gift,
  Guest,
  PlannerState,
  Reservation,
  ReservationStatus,
  Rsvp,
} from '../types'
import { GIFT_CATEGORIES } from '../constants'
import { guestDigits, newGuestRow } from './guestMatching'
import { GuestImportPanel } from './GuestImportPanel'

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
  onGuestListChange,
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
  onGuestListChange: (guestList: Guest[]) => void
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
        <p className="form-hint gift-guide-form-intro">
          Ponizsze pola sa widoczne na zakladce <strong>Prezenty</strong> dla zaproszonych — pomagaja dobrac
          prezent niezaleznie od listy pomyslow.
        </p>
        <label>
          Rozmiary ubrań i obuwia
          <textarea
            value={planner.event.giftClothingSizes}
            onChange={(event) => onEventChange('giftClothingSizes', event.target.value)}
            placeholder="np. rozmiar ubran 116, buty 29, czapka obwod"
          />
        </label>
        <label>
          Ulubione kolory i styl
          <textarea
            value={planner.event.giftColorNotes}
            onChange={(event) => onEventChange('giftColorNotes', event.target.value)}
            placeholder="np. pastelowe roze i zielen, bez neonow"
          />
        </label>
        <label>
          Bajki, ksiazki, postacie (motyw)
          <textarea
            value={planner.event.giftMediaFavorites}
            onChange={(event) => onEventChange('giftMediaFavorites', event.target.value)}
            placeholder="np. ulubiona bajka, seria ksiazek, bohaterowie"
          />
        </label>
        <label>
          Lista zyczen / list do Mikolaja
          <textarea
            value={planner.event.giftWishListNotes}
            onChange={(event) => onEventChange('giftWishListNotes', event.target.value)}
            placeholder="np. krotki list zyczen dziecka albo ogolne kierunki na prezent"
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
          Kazdy wiersz: nazwa (np. rodzic dziecka) oraz telefon z min. 9 cyframi. Puste lub
          niepelne wiersze sa pomijane przy zapisie online.
        </p>
        <div className="guest-list-editor">
          <div className="guest-list-toolbar">
            <button
              className="button secondary"
              type="button"
              onClick={() => onGuestListChange([...planner.guestList, newGuestRow()])}
            >
              Dodaj goscia
            </button>
            <GuestImportPanel
              onImport={(imported) => {
                const next = imported.map((p) => ({
                  ...newGuestRow(),
                  name: p.name,
                  contact: p.phone,
                }))
                onGuestListChange([...planner.guestList, ...next])
              }}
            />
          </div>
          {planner.guestList.length ? (
            <table className="guest-list-editor-table">
              <thead>
                <tr>
                  <th scope="col">Nazwa</th>
                  <th scope="col">Telefon</th>
                  <th scope="col" className="guest-list-editor-actions">
                    <span className="visually-hidden">Akcje</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {planner.guestList.map((guest) => (
                  <tr key={guest.id}>
                    <td>
                      <input
                        aria-label="Nazwa goscia"
                        value={guest.name}
                        onChange={(event) =>
                          onGuestListChange(
                            planner.guestList.map((row) =>
                              row.id === guest.id ? { ...row, name: event.target.value } : row,
                            ),
                          )
                        }
                        placeholder="np. Mama Janka"
                      />
                    </td>
                    <td>
                      <input
                        aria-label="Telefon goscia"
                        type="tel"
                        inputMode="tel"
                        value={guest.contact}
                        onChange={(event) =>
                          onGuestListChange(
                            planner.guestList.map((row) =>
                              row.id === guest.id ? { ...row, contact: event.target.value } : row,
                            ),
                          )
                        }
                        placeholder="np. 500 600 700"
                      />
                    </td>
                    <td className="guest-list-editor-actions">
                      <button
                        className="button secondary guest-list-remove"
                        type="button"
                        onClick={() => onGuestListChange(planner.guestList.filter((row) => row.id !== guest.id))}
                      >
                        Usun
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="form-hint guest-list-empty-hint">
              Lista pusta — rodzice podaja imie i kontakt bez sprawdzania wzgledem listy.
            </p>
          )}
        </div>
        <p className="form-hint">
          Wierszy w edytorze: {planner.guestList.length}. Gotowych do zapisu (nazwa + telefon):{' '}
          {planner.guestList.filter((g) => g.name.trim() && guestDigits(g.contact).length >= 9).length}.
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
            const isBought = reservation.status === 'bought'

            return (
              <article
                className={`approval-card${isBought ? ' approval-card--bought' : ''}`}
                key={reservation.id}
              >
                <p className="gift-meta">{gift?.title}</p>
                <h4>{reservation.guestName}</h4>
                <p>{reservation.contact}</p>
                {isBought ? (
                  <div className="reservation-bought-block">
                    <span className="pill state-kupiony">Kupiony</span>
                    <p className="reservation-bought-text">Ten prezent jest oznaczony jako kupiony.</p>
                  </div>
                ) : (
                  <button
                    className="button secondary"
                    type="button"
                    onClick={() => onReservationStatusChange(reservation.id, 'bought')}
                  >
                    Oznacz jako kupiony
                  </button>
                )}
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
        <p className="form-hint">{rsvp.adults} doroslych, {rsvp.children} dzieci</p>
      ) : null}
      {rsvp.note ? <p className="form-hint">{rsvp.note}</p> : null}
    </article>
  )
}
