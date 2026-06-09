import type { ApiResponse, EventApiRequest } from '../types'

export const API_URL = '/.netlify/functions/events'

export async function parseApiResponse(response: Response): Promise<ApiResponse> {
  const text = await response.text()
  let body: ApiResponse = {}
  if (text) {
    try {
      body = JSON.parse(text) as ApiResponse
    } catch {
      throw new Error(
        response.ok
          ? 'Serwer zwrocil nieprawidlowa odpowiedz (nie JSON).'
          : `Blad serwera (${response.status}). Sprawdz czy funkcja Netlify jest wdrozona i czy adres API jest poprawny.`,
      )
    }
  }

  if (!response.ok) {
    const hint =
      response.status === 503
        ? ' Sprawdz w panelu Netlify zmienna STRIPE_SECRET_KEY.'
        : ''
    throw new Error((body.error && String(body.error)) || `Zapytanie nie powiodlo sie (${response.status}).${hint}`)
  }

  return body
}

export async function readApiResponse(response: Response) {
  const body = await parseApiResponse(response)
  if (!body.event) throw new Error('Brak danych wydarzenia w odpowiedzi API.')

  return body.event
}

export async function callEventApi(body: EventApiRequest) {
  return fetch(API_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }).then(readApiResponse)
}
