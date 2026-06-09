import type { PlannerState } from '../types'
import type { RsvpSummary } from './guestMatching'

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
            <article className={`approval-card rsvp-public-tile attendance-tile-${rsvp.status}`} key={rsvp.id}>
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
