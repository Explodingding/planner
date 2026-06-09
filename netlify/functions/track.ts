import { getStore } from '@netlify/blobs'

/**
 * Minimalna analityka lejka: dzienne liczniki zdarzeń w Netlify Blobs.
 * Bez cookies, bez identyfikatorów użytkownika — tylko nazwane zliczenia.
 *
 * POST { name } — inkrementuje licznik (zawsze 204, nawet przy błędzie).
 * GET ?token=...&days=14 — odczyt liczników; wymaga zmiennej środowiskowej STATS_TOKEN.
 */

const STORE_NAME = 'planner-analytics'

const ALLOWED_EVENTS = new Set([
  'checkout_start',
  'checkout_cancel',
  'checkout_success_return',
  'create_ok',
  'create_fail',
  'event_view',
  'manage_view',
  'reserve_ok',
  'rsvp_ok',
])

function dayKey(date: Date) {
  return `daily/${date.toISOString().slice(0, 10)}`
}

async function handleTrack(req: Request) {
  let name = ''
  try {
    const body = (await req.json()) as { name?: unknown }
    name = String(body?.name ?? '')
  } catch {
    return new Response(null, { status: 204 })
  }

  if (!ALLOWED_EVENTS.has(name)) return new Response(null, { status: 204 })

  try {
    const store = getStore(STORE_NAME)
    const key = dayKey(new Date())
    const current =
      ((await store.get(key, { type: 'json', consistency: 'strong' })) as Record<
        string,
        number
      > | null) ?? {}
    current[name] = (current[name] ?? 0) + 1
    await store.setJSON(key, current)
  } catch (error) {
    // Zgubiony pojedynczy hit jest akceptowalny; nie zwracamy błędu do klienta.
    console.error('Nie udalo sie zapisac zdarzenia analitycznego', error)
  }

  return new Response(null, { status: 204 })
}

async function handleStats(req: Request) {
  const expected = process.env.STATS_TOKEN
  const url = new URL(req.url)

  if (!expected || url.searchParams.get('token') !== expected) {
    return new Response('Not found', { status: 404 })
  }

  const daysParam = Number(url.searchParams.get('days') ?? 14)
  const days = Number.isFinite(daysParam) ? Math.min(60, Math.max(1, Math.floor(daysParam))) : 14

  const store = getStore(STORE_NAME)
  const result: Record<string, Record<string, number>> = {}

  for (let i = 0; i < days; i += 1) {
    const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
    const data = (await store.get(dayKey(date), { type: 'json' })) as Record<
      string,
      number
    > | null
    if (data) result[date.toISOString().slice(0, 10)] = data
  }

  return new Response(JSON.stringify(result, null, 2), {
    headers: { 'content-type': 'application/json' },
  })
}

export default async (req: Request) => {
  if (req.method === 'POST') return handleTrack(req)
  if (req.method === 'GET') return handleStats(req)
  return new Response('Method not allowed', { status: 405 })
}
