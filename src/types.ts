export type ReservationStatus = 'pending' | 'approved' | 'rejected' | 'bought'
export type AttendanceStatus = 'yes' | 'no' | 'maybe'

export type EventDetails = {
  childName: string
  date: string
  place: string
  theme: string
  notes: string
}

export type Gift = {
  id: string
  title: string
  category: string
  details: string
  priceHint: string
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
  gifts: Gift[]
  reservations: Reservation[]
  rsvps: Rsvp[]
}

export type EventRecord = {
  id: string
  organizerToken: string
  planner: PlannerState
  createdAt: string
  updatedAt: string
}

export type PublicEventRecord = Omit<EventRecord, 'organizerToken'> & {
  canManage: boolean
  publicUrl: string
  manageUrl?: string
}

export type VerifiedGuest = {
  name: string
  contact: string
}
