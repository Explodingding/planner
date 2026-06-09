import { useRef, useState } from 'react'

// ── WhatsApp / plain-text / vCard guest importer ──────────────────────────────

function parseWhatsAppExport(text: string): string[] {
  // Matches: [DD.MM.YYYY, HH:MM:SS] Name: msg  OR  DD.MM.YYYY, HH:MM - Name: msg
  const re = /(?:\[\d{1,2}[./]\d{1,2}[./]\d{2,4},?\s+\d{1,2}:\d{2}(?::\d{2})?\]\s*|^\d{1,2}[./]\d{1,2}[./]\d{2,4},\s*\d{1,2}:\d{2}\s*-\s*)([^:\n\r]+):/gm
  const names = new Set<string>()
  let match: RegExpExecArray | null
  while ((match = re.exec(text)) !== null) {
    const name = match[1].trim()
    // skip system messages (digits-only, "Ty", short codes)
    if (name && name.length > 1 && !/^\d+$/.test(name)) names.add(name)
  }
  return [...names]
}

function parseVCard(text: string): { name: string; phone: string }[] {
  const cards = text.split(/BEGIN:VCARD/i).slice(1)
  return cards.flatMap((card) => {
    const fnMatch = card.match(/^FN[^:]*:(.+)$/im)
    const telMatch = card.match(/^TEL[^:]*:(.+)$/im)
    const name = fnMatch?.[1]?.trim() ?? ''
    const phone = telMatch?.[1]?.trim().replace(/\s+/g, '') ?? ''
    return name ? [{ name, phone }] : []
  })
}

function parsePlainList(text: string): string[] {
  return text
    .split(/[\r\n]+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 1)
}

export function GuestImportPanel({ onImport }: { onImport: (names: { name: string; phone: string }[]) => void }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [mode, setMode] = useState<'auto' | 'plain'>('auto')
  const [preview, setPreview] = useState<{ name: string; phone: string }[] | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function detect(raw: string): { name: string; phone: string }[] {
    if (/BEGIN:VCARD/i.test(raw)) return parseVCard(raw)
    const waNames = parseWhatsAppExport(raw)
    if (waNames.length > 0 && mode === 'auto') return waNames.map((name) => ({ name, phone: '' }))
    return parsePlainList(raw).map((name) => ({ name, phone: '' }))
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const raw = ev.target?.result as string
      setText(raw)
      setPreview(detect(raw))
    }
    reader.readAsText(file, 'utf-8')
  }

  function handlePreview() {
    setPreview(detect(text))
  }

  function handleImport() {
    const list = preview ?? detect(text)
    if (!list.length) return
    onImport(list)
    setText('')
    setPreview(null)
    setOpen(false)
  }

  if (!open) {
    return (
      <button className="button secondary" type="button" onClick={() => setOpen(true)}>
        Importuj liste
      </button>
    )
  }

  return (
    <div className="import-panel">
      <div className="import-panel-header">
        <strong>Importuj liste gosci</strong>
        <button className="button secondary import-panel-close" type="button" onClick={() => { setOpen(false); setText(''); setPreview(null) }}>
          Zamknij
        </button>
      </div>

      <div className="import-panel-tabs">
        <button
          type="button"
          className={`import-tab${mode === 'auto' ? ' is-active' : ''}`}
          onClick={() => { setMode('auto'); setPreview(null) }}
        >
          WhatsApp / auto
        </button>
        <button
          type="button"
          className={`import-tab${mode === 'plain' ? ' is-active' : ''}`}
          onClick={() => { setMode('plain'); setPreview(null) }}
        >
          Lista imion
        </button>
      </div>

      {mode === 'auto' ? (
        <p className="form-hint">
          Wyeksportuj czat grupy z WhatsApp (<em>Ustawienia czatu → Eksportuj czat → Bez mediow</em>),
          wklej tresc ponizej lub wczytaj plik .txt. Wykrywa tez pliki .vcf z kontaktami.
        </p>
      ) : (
        <p className="form-hint">
          Wpisz lub wklej imiona gosci — jedno imie na linijke. Numery telefonow mozna uzupelnic pozniej w tabeli.
        </p>
      )}

      <div className="import-panel-inputs">
        <textarea
          className="import-textarea"
          placeholder={mode === 'auto'
            ? '[01.06.2025, 10:00:00] Anna Kowalska: Hej!\n[01.06.2025, 10:01:00] Piotr Nowak: Czesc!'
            : 'Anna Kowalska\nPiotr Nowak\nMama Zosi'}
          value={text}
          onChange={(e) => { setText(e.target.value); setPreview(null) }}
          rows={6}
        />
        <div className="import-panel-actions">
          <label className="import-file-label">
            Wczytaj plik (.txt / .vcf)
            <input
              ref={fileRef}
              type="file"
              accept=".txt,.vcf,text/plain,text/vcard"
              className="visually-hidden"
              onChange={handleFile}
            />
          </label>
          <button className="button secondary" type="button" onClick={handlePreview} disabled={!text.trim()}>
            Podglad
          </button>
        </div>
      </div>

      {preview !== null && (
        <div className="import-preview">
          <p className="import-preview-count">
            Znaleziono {preview.length} {preview.length === 1 ? 'osobe' : preview.length < 5 ? 'osoby' : 'osob'}.
            {preview.length === 0 && ' Sprawdz format — nie rozpoznano zadnych imion.'}
          </p>
          {preview.length > 0 && (
            <ul className="import-preview-list">
              {preview.slice(0, 8).map((p, i) => (
                <li key={i}><strong>{p.name}</strong>{p.phone ? ` · ${p.phone}` : ''}</li>
              ))}
              {preview.length > 8 && <li className="form-hint">...i {preview.length - 8} wiecej</li>}
            </ul>
          )}
          {preview.length > 0 && (
            <button className="button primary" type="button" onClick={handleImport}>
              Dodaj {preview.length} {preview.length === 1 ? 'osobe' : preview.length < 5 ? 'osoby' : 'osob'} do listy
            </button>
          )}
        </div>
      )}
    </div>
  )
}
