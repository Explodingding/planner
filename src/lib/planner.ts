import { emptyPlanner } from '../demoData'
import type { Guest, PlannerState } from '../types'

export const DRAFT_STORAGE_KEY = 'prezentownik-production-draft'
/** Dane organizatora zachowane przed przekierowaniem do Stripe Checkout (legacy, tylko sprzątanie). */
export const CHECKOUT_ORGANIZER_KEY = 'prezentownik-checkout-organizer'

export function loadPlannerDraft(): PlannerState {
  try {
    const stored = localStorage.getItem(DRAFT_STORAGE_KEY)
    if (!stored) return emptyPlanner

    const parsed = JSON.parse(stored) as Partial<PlannerState>

    return {
      event: { ...emptyPlanner.event, ...(parsed.event ?? {}) },
      guestList: parsed.guestList ?? [],
      gifts: (parsed.gifts ?? []).map((gift) => ({
        ...gift,
        link: typeof gift.link === 'string' ? gift.link : '',
      })),
      reservations: [],
      rsvps: [],
    }
  } catch {
    return emptyPlanner
  }
}

export function createId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`
}

export function formatDate(value: string) {
  if (!value) return 'Termin do ustalenia'

  return new Intl.DateTimeFormat('pl-PL', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function digitsOnly(value: string) {
  return value.replace(/\D/g, '')
}

export function phonesMatch(a: string, b: string): boolean {
  const da = digitsOnly(a)
  const db = digitsOnly(b)
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

export function guestListRowComplete(guest: Guest): boolean {
  return Boolean(guest.name.trim() && digitsOnly(guest.contact).length >= 9)
}

export function sanitizeGuestListForApi(list: Guest[]): Guest[] {
  return list.filter(guestListRowComplete)
}
