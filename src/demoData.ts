import type { PlannerState } from './types'

export const initialState: PlannerState = {
  event: {
    childName: 'Tosia',
    date: '2026-05-24T15:00',
    place: 'Sala zabaw Kolorowe Klocki, Warszawa',
    theme: 'Urodziny w klimacie zwierzakow i klockow',
    notes:
      'Tosia lubi LEGO Friends, puzzle, kredki i ksiazki o zwierzetach. Prosimy unikac pluszakow, bo mamy ich juz bardzo duzo.',
  },
  gifts: [
    {
      id: 'gift-lego',
      title: 'Zestaw LEGO Friends',
      category: 'Klocki',
      details: 'Najlepiej maly lub sredni zestaw ze zwierzakami albo domkiem.',
      priceHint: '60-120 zl',
    },
    {
      id: 'gift-book',
      title: 'Ksiazka o zwierzetach',
      category: 'Ksiazki',
      details: 'Ilustrowana, dla dzieci 5-6 lat.',
      priceHint: '30-60 zl',
    },
    {
      id: 'gift-art',
      title: 'Porzadne kredki lub flamastry',
      category: 'Kreatywne',
      details: 'Zestaw do rysowania, najlepiej zmywalny.',
      priceHint: '40-80 zl',
    },
  ],
  reservations: [
    {
      id: 'reservation-demo',
      giftId: 'gift-book',
      guestName: 'Mama Janka',
      contact: 'mama.janka@example.com',
      message: 'Moge kupic ksiazke i dorzuce kartke od Janka.',
      status: 'pending',
      createdAt: new Date().toISOString(),
    },
  ],
  rsvps: [
    {
      id: 'rsvp-demo-yes',
      guestName: 'Mama Janka',
      contact: 'mama.janka@example.com',
      status: 'yes',
      adults: 1,
      children: 1,
      note: 'Janek bedzie, dziekujemy za zaproszenie.',
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'rsvp-demo-maybe',
      guestName: 'Rodzice Hani',
      contact: 'hania@example.com',
      status: 'maybe',
      adults: 1,
      children: 1,
      note: 'Potwierdzimy po weekendzie.',
      updatedAt: new Date().toISOString(),
    },
  ],
}
