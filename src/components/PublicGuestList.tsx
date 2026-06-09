import type { PlannerState } from '../types'
import { findRsvpForGuest, guestRowAttendanceTitle } from './guestMatching'

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
    <div className="guest-list-public-wrap">
      <table className="guest-list-public-table">
        <thead>
          <tr>
            <th scope="col">Nazwa</th>
            <th scope="col">Telefon</th>
          </tr>
        </thead>
        <tbody>
          {planner.guestList.map((guest) => {
            const rsvp = findRsvpForGuest(guest, planner.rsvps)
            const tone = rsvp ? rsvp.status : 'awaiting'
            return (
              <tr
                key={guest.id}
                className={`guest-list-rsvp-row guest-list-rsvp-row--${tone}`}
                title={guestRowAttendanceTitle(rsvp)}
              >
                <td>{guest.name}</td>
                <td className="guest-list-phone-cell">{guest.contact?.trim() || '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
