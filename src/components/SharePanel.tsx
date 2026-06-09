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
