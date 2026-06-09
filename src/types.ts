export type ReservationStatus = 'pending' | 'approved' | 'rejected' | 'bought'
export type AttendanceStatus = 'yes' | 'no' | 'maybe'
export type EventStatus = 'active' | 'archived'
export type EventVisibility = 'public_link'
export type ApiAction =
  | 'create'
  | 'createEventCheckout'
  | 'updateEvent'
  | 'updateGuestList'
  | 'addGift'
  | 'reserveGift'
  | 'submitRsvp'
  | 'updateReservationStatus'

export type EventDetails = {
  childName: string
  date: string
  place: string
  theme: string
  notes: string
  /** Rozmiary ubrań (np. buty, czapka) — wskazówka dla gości kupujących prezenty. */
  giftClothingSizes: string
  /** Ulubione kolory, styl. */
  giftColorNotes: string
  /** Motyw: ulubione bajki, książki, postacie. */
  giftMediaFavorites: string
  /** Lista życzeń dziecka / „list do Mikołaja”. */
  giftWishListNotes: string
}

export type Gift = {
  id: string
  title: string
  category: string
  details: string
  /** Opcjonalny link do oferty (np. sklep). Pusty string = brak linku. */
  link: string
}

export type Guest = {
  id: string
  name: string
  /** Numer telefonu gościa; przy zapisie listy wymagane min. 9 cyfr. W widoku publicznym może być zwrócony w formie maski. */
  contact: string
}

export type Reservation = {
  id: string
  giftId: string
  guestName: string
  contact: string
  message: string
  status: ReservationStatus
  createdAt: string
}

export type Rsvp = {
  id: string
  guestName: string
  contact: string
  status: AttendanceStatus
  adults: number
  children: number
  note: string
  updatedAt: string
}

export type PlannerState = {
  event: EventDetails
  guestList: Guest[]
  gifts: Gift[]
  reservations: Reservation[]
  rsvps: Rsvp[]
}

export type EventRecord = {
  id: string
  organizerToken: string
  version: number
  status: EventStatus
  visibility: EventVisibility
  createdBy: string
  lastUpdatedBy: string
  planner: PlannerState
  createdAt: string
  updatedAt: string
}

export type PublicEventRecord = Omit<EventRecord, 'organizerToken' | 'lastUpdatedBy'> & {
  canManage: boolean
  publicUrl: string
  manageUrl?: string
}

export type VerifiedGuest = {
  name: string
  contact: string
}

export type ApiResponse = {
  event?: PublicEventRecord
  error?: string
  /** Tylko dla `createEventCheckout` — adres Stripe Checkout. */
  checkoutUrl?: string
}

export type CreateEventRequest = {
  action: 'create'
  /** Identyfikator sesji Stripe Checkout po udanej płatności (query `session_id`). Dane wydarzenia są odtwarzane ze snapshotu zapisanego na serwerze przed płatnością. */
  stripeCheckoutSessionId: string
  spamTrap?: string
}

export type CreateEventCheckoutRequest = {
  action: 'createEventCheckout'
  /** Szkic wydarzenia zapisywany na serwerze przed przekierowaniem do płatności. */
  planner: PlannerState
  organizerName: string
  organizerContact: string
  spamTrap?: string
}

export type ManagedEventRequest =
  | {
      action: 'updateEvent'
      id: string
      token: string
      event: EventDetails
    }
  | {
      action: 'addGift'
      id: string
      token: string
      gift: Omit<Gift, 'id'>
    }
  | {
      action: 'updateGuestList'
      id: string
      token: string
      guestList: Guest[]
    }
  | {
      action: 'updateReservationStatus'
      id: string
      token: string
      reservationId: string
      status: ReservationStatus
    }

export type PublicEventRequest =
  | {
      action: 'reserveGift'
      id: string
      reservation: Omit<Reservation, 'id' | 'status' | 'createdAt'>
      spamTrap?: string
    }
  | {
      action: 'submitRsvp'
      id: string
      rsvp: Omit<Rsvp, 'id' | 'updatedAt'>
      spamTrap?: string
    }

export type EventApiRequest =
  | CreateEventRequest
  | CreateEventCheckoutRequest
  | ManagedEventRequest
  | PublicEventRequest
