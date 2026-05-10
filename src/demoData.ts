import type { PlannerState } from './types'

export const emptyPlanner: PlannerState = {
  event: {
    childName: '',
    date: '',
    place: '',
    theme: '',
    notes: '',
    giftClothingSizes: '',
    giftColorNotes: '',
    giftMediaFavorites: '',
    giftWishListNotes: '',
  },
  guestList: [],
  gifts: [],
  reservations: [],
  rsvps: [],
}

export const initialState: PlannerState = {
  event: {
    childName: 'Tosia',
    date: '2026-05-24T15:00',
    place: 'Sala zabaw Kolorowe Klocki, Warszawa',
    theme: 'Urodziny w klimacie zwierzakow i klockow',
    notes:
      'Tosia lubi LEGO Friends, puzzle, kredki i ksiazki o zwierzetach. Prosimy unikac pluszakow, bo mamy ich juz bardzo duzo.',
    giftClothingSizes: 'Ubrania ok. 116, buty 29–30, czapka 54.',
    giftColorNotes: 'Róż, mięta, pastelowe odcienie. Unikać neonów.',
    giftMediaFavorites: 'Kraina Lodu, Myszka Miki, seria „Zwierzaki z zoo”.',
    giftWishListNotes:
      'LEGO Friends (mały zestaw), kredki akwarelowe, puzzle 100 elementów, książka z naklejkami o zwierzętach.',
  },
  guestList: [
    {
      id: 'guest-janek',
      name: 'Mama Janka',
      contact: '500111222',
    },
    {
      id: 'guest-hania',
      name: 'Rodzice Hani',
      contact: '+48 501 333 444',
    },
    {
      id: 'guest-franek',
      name: 'Rodzice Franka',
      contact: '502555666',
    },
  ],
  gifts: [
    {
      id: 'gift-lego',
      title: 'Zestaw LEGO Friends',
      category: 'Klocki',
      details: 'Najlepiej maly lub sredni zestaw ze zwierzakami albo domkiem.',
      link: 'https://allegro.pl/listing?string=lego+friends',
    },
    {
      id: 'gift-book',
      title: 'Ksiazka o zwierzetach',
      category: 'Ksiazki',
      details: 'Ilustrowana, dla dzieci 5-6 lat.',
      link: '',
    },
    {
      id: 'gift-art',
      title: 'Porzadne kredki lub flamastry',
      category: 'Kreatywne',
      details: 'Zestaw do rysowania, najlepiej zmywalny.',
      link: '',
    },
  ],
  reservations: [
    {
      id: 'reservation-demo',
      giftId: 'gift-book',
      guestName: 'Mama Janka',
      contact: '500111222',
      message: 'Moge kupic ksiazke i dorzuce kartke od Janka.',
      status: 'pending',
      createdAt: new Date().toISOString(),
    },
  ],
  rsvps: [
    {
      id: 'rsvp-demo-yes',
      guestName: 'Mama Janka',
      contact: '500111222',
      status: 'yes',
      adults: 1,
      children: 1,
      note: 'Janek bedzie, dziekujemy za zaproszenie.',
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'rsvp-demo-maybe',
      guestName: 'Rodzice Hani',
      contact: '+48501333444',
      status: 'maybe',
      adults: 1,
      children: 1,
      note: 'Potwierdzimy po weekendzie.',
      updatedAt: new Date().toISOString(),
    },
  ],
}
