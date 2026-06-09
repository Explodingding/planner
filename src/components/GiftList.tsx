import type { PlannerState, Reservation } from '../types'

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

        const state = getGiftState(gift.id)

        return (
          <article className={`gift-card gift-card--${state}`} key={gift.id}>
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
                <span className={`pill state-${state}`}>{state}</span>
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
