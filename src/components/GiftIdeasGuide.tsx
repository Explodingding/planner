import type { EventDetails } from '../types'

const GIFT_GUIDE_FIELDS: { key: keyof EventDetails; label: string }[] = [
  { key: 'giftClothingSizes', label: 'Rozmiary ubrań i obuwia' },
  { key: 'giftColorNotes', label: 'Ulubione kolory i styl' },
  { key: 'giftMediaFavorites', label: 'Bajki, książki, postacie' },
  { key: 'giftWishListNotes', label: 'Lista życzeń / list do Mikołaja' },
]

function giftGuideHasContent(event: EventDetails): boolean {
  return GIFT_GUIDE_FIELDS.some(({ key }) => event[key]?.trim())
}

export function GiftIdeasGuide({ event }: { event: EventDetails }) {
  if (!giftGuideHasContent(event)) return null

  return (
    <section className="gift-ideas-guide" aria-label="Wskazówki na prezenty">
      <p className="eyebrow">Wskazówki dla gości</p>
      <h3 className="gift-ideas-guide-title">Co warto wiedzieć przed zakupem</h3>
      <div className="gift-ideas-guide-grid">
        {GIFT_GUIDE_FIELDS.map(({ key, label }) => {
          const text = event[key]?.trim()
          if (!text) return null
          return (
            <article className="gift-guide-block" key={key}>
              <h4 className="gift-guide-block-title">{label}</h4>
              <p className="gift-guide-block-body">{text}</p>
            </article>
          )
        })}
      </div>
    </section>
  )
}
