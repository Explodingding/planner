import type { Guest, Rsvp } from '../types'

/** Wspólne helpery dopasowywania gości i RSVP (lista gości, widoki publiczne, panel organizatora). */

export function guestDigits(value: string) {
  return value.replace(/\D/g, '')
}

export function newGuestRow(): Guest {
  return { id: `guest-${crypto.randomUUID()}`, name: '', contact: '' }
}

export function normalizeGuestLookup(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, '')
}

export function phonesMatchListed(a: string, b: string): boolean {
  const da = guestDigits(a)
  const db = guestDigits(b)
  if (da.length < 9 || db.length < 9) return false
  if (da === db) return true

  const stripPl = (d: string) => {
    if (d.startsWith('48') && d.length >= 11) return d.slice(2)
    if (d.startsWith('0') && d.length >= 10) return d.slice(1)
    return d
  }

  const sa = stripPl(da)
  const sb = stripPl(db)
  if (sa === sb) return true
  if (sa.length >= 9 && sb.length >= 9 && sa.slice(-9) === sb.slice(-9)) return true

  return false
}

export function pickLatestRsvp(matches: Rsvp[]): Rsvp | undefined {
  if (!matches.length) return undefined
  return [...matches].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
}

export function findRsvpForGuest(guest: Guest, rsvps: Rsvp[]): Rsvp | undefined {
  const byPhone = rsvps.filter(
    (r) => r.contact?.trim() && guest.contact?.trim() && phonesMatchListed(r.contact, guest.contact),
  )
  const fromPhone = pickLatestRsvp(byPhone)
  if (fromPhone) return fromPhone

  const nameKey = normalizeGuestLookup(guest.name)
  return pickLatestRsvp(rsvps.filter((r) => normalizeGuestLookup(r.guestName) === nameKey))
}

export function guestRowAttendanceTitle(rsvp: Rsvp | undefined): string {
  if (!rsvp) return 'Brak odpowiedzi o obecnosci'
  if (rsvp.status === 'yes') return 'Obecnosc: bedziemy'
  if (rsvp.status === 'maybe') return 'Obecnosc: jeszcze nie wiemy'
  return 'Obecnosc: nie bedzie nas'
}

export type RsvpSummary = {
  yes: number
  no: number
  maybe: number
  adults: number
  children: number
}
