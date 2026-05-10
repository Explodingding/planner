import { type FormEvent, useState } from 'react'

type SubmitState = 'idle' | 'sending' | 'success' | 'error'

export function SuggestionForm() {
  const [state, setState] = useState<SubmitState>('idle')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const strona = form.elements.namedItem('strona') as HTMLInputElement
    strona.value = typeof window !== 'undefined' ? window.location.href : ''

    setState('sending')
    try {
      const body = new URLSearchParams(new FormData(form) as never).toString()
      const response = await fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      })
      if (response.ok) {
        setState('success')
        form.reset()
      } else {
        setState('error')
      }
    } catch {
      setState('error')
    }
  }

  return (
    <div className="suggestion-form-wrap">
      <p className="eyebrow">Twój głos</p>
      <h2 className="suggestion-form-heading">Zaproponuj zmianę</h2>
      <p className="form-hint suggestion-form-lead">
        Masz pomysł na ulepszenie Prezentownika? Napisz krótko, co warto zmienić lub dodać.
        Wiadomość trafia do zespołu przez{' '}
        <a href="https://docs.netlify.com/forms/setup/" rel="noreferrer" target="_blank">
          Netlify Forms
        </a>
        .
      </p>
      <form
        className="suggestion-form"
        method="post"
        name="propozycje-zmian"
        data-netlify="true"
        data-netlify-honeypot="bot-field"
        onSubmit={handleSubmit}
      >
        <input name="form-name" type="hidden" value="propozycje-zmian" />
        <p className="spam-field" aria-hidden="true">
          <label>
            Nie wypełniaj tego pola
            <input name="bot-field" tabIndex={-1} />
          </label>
        </p>
        <input name="strona" type="hidden" value="" />
        <label>
          Treść propozycji
          <textarea
            name="tresc"
            required
            rows={4}
            placeholder="np. Fajnie byłoby móc dodawać zdjęcie dziecka do wydarzenia..."
            disabled={state === 'sending'}
          />
        </label>
        <label>
          E-mail (opcjonalnie, jeśli chcesz odpowiedź)
          <input
            name="email"
            type="email"
            autoComplete="email"
            placeholder="twoj@email.pl"
            disabled={state === 'sending'}
          />
        </label>
        <button className="button secondary" disabled={state === 'sending'} type="submit">
          {state === 'sending' ? 'Wysyłanie...' : 'Wyślij propozycję'}
        </button>
      </form>
      {state === 'success' ? (
        <p className="suggestion-form-feedback suggestion-form-feedback--ok" role="status">
          Dziękujemy! Propozycja została wysłana.
        </p>
      ) : null}
      {state === 'error' ? (
        <p className="suggestion-form-feedback suggestion-form-feedback--err" role="alert">
          Nie udało się wysłać. Spróbuj ponownie za chwilę albo napisz bezpośrednio do organizatora
          wydarzenia.
        </p>
      ) : null}
    </div>
  )
}
