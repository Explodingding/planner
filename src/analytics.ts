/**
 * Minimalna analityka lejka: zliczanie zdarzeń bez identyfikatorów użytkownika
 * i bez cookies. Wysyłka fire-and-forget — błąd analityki nigdy nie psuje aplikacji.
 */

const TRACK_URL = '/.netlify/functions/track'

export type FunnelEvent =
  | 'checkout_start'
  | 'checkout_cancel'
  | 'checkout_success_return'
  | 'create_ok'
  | 'create_fail'
  | 'event_view'
  | 'manage_view'
  | 'reserve_ok'
  | 'rsvp_ok'

export function track(name: FunnelEvent) {
  try {
    const payload = JSON.stringify({ name })

    if (
      typeof navigator.sendBeacon === 'function' &&
      navigator.sendBeacon(TRACK_URL, new Blob([payload], { type: 'application/json' }))
    ) {
      return
    }

    void fetch(TRACK_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => {})
  } catch {
    // brak analityki nie może wpływać na użytkownika
  }
}
