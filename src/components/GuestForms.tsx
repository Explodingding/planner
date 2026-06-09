import type { FormEvent } from 'react'
import type { AttendanceStatus, PlannerState, VerifiedGuest } from '../types'

export function GuestForms({
  planner,
  verifiedGuest,
  guestName,
  guestContact,
  verificationSent,
  selectedGiftId,
  reservationMessage,
  attendanceStatus,
  attendanceAdults,
  attendanceChildren,
  attendanceNote,
  spamTrap,
  onGuestNameChange,
  onGuestContactChange,
  onSendVerification,
  onConfirmVerification,
  onSelectedGiftChange,
  onReservationMessageChange,
  onAttendanceStatusChange,
  onAttendanceAdultsChange,
  onAttendanceChildrenChange,
  onAttendanceNoteChange,
  onSpamTrapChange,
  onRequestReservation,
  onSubmitRsvp,
}: {
  planner: PlannerState
  verifiedGuest: VerifiedGuest | null
  guestName: string
  guestContact: string
  verificationSent: boolean
  selectedGiftId: string
  reservationMessage: string
  attendanceStatus: AttendanceStatus
  attendanceAdults: number
  attendanceChildren: number
  attendanceNote: string
  spamTrap: string
  onGuestNameChange: (value: string) => void
  onGuestContactChange: (value: string) => void
  onSendVerification: (event: FormEvent<HTMLFormElement>) => void
  onConfirmVerification: () => void
  onSelectedGiftChange: (value: string) => void
  onReservationMessageChange: (value: string) => void
  onAttendanceStatusChange: (value: AttendanceStatus) => void
  onAttendanceAdultsChange: (value: number) => void
  onAttendanceChildrenChange: (value: number) => void
  onAttendanceNoteChange: (value: string) => void
  onSpamTrapChange: (value: string) => void
  onRequestReservation: (event: FormEvent<HTMLFormElement>) => void
  onSubmitRsvp: (event: FormEvent<HTMLFormElement>) => void
}) {
  const usesGuestList = planner.guestList.length > 0

  const contactFieldOpen = (
    <label>
      E-mail lub telefon
      <input
        type="text"
        name="guest-contact"
        autoComplete="off"
        inputMode="text"
        enterKeyHint="next"
        value={guestContact}
        onChange={(event) => onGuestContactChange(event.target.value)}
        placeholder="np. anna@example.com lub 500 600 700"
        required
      />
    </label>
  )

  const contactFieldListed = (
    <label>
      Numer telefonu z listy
      <input
        type="tel"
        name="guest-contact"
        autoComplete="off"
        inputMode="tel"
        enterKeyHint="done"
        value={guestContact}
        onChange={(event) => onGuestContactChange(event.target.value)}
        placeholder="np. 500 600 700"
        required
      />
    </label>
  )

  const nameField = (
    <label>
      Imie lub opis
      <input
        type="text"
        name="guest-display-name"
        autoComplete="name"
        inputMode="text"
        enterKeyHint="done"
        value={guestName}
        onChange={(event) => onGuestNameChange(event.target.value)}
        placeholder="np. Mama Janka"
        required
      />
    </label>
  )

  return (
    <div className="grid two-columns reservation-area">
      <form className="form-card" onSubmit={onSendVerification}>
        <h3>1. Potwierdz osobe</h3>
        {usesGuestList ? (
          <p className="form-hint">
            Przy liscie zaproszonych potwierdzamy wylacznie po <strong>numerze telefonu</strong> z listy
            organizatora. Imie wyswietlimy automatycznie po dopasowaniu numeru.
          </p>
        ) : (
          <p className="form-hint">Podaj imie oraz e-mail lub telefon.</p>
        )}
        {usesGuestList ? contactFieldListed : (
          <>
            {nameField}
            {contactFieldOpen}
          </>
        )}
        <label className="spam-field">
          Website
          <input
            autoComplete="off"
            tabIndex={-1}
            value={spamTrap}
            onChange={(event) => onSpamTrapChange(event.target.value)}
          />
        </label>
        <button className="button primary" type="submit">
          Potwierdz dane
        </button>
        {verificationSent ? (
          <div className="verification-box">
            <p>
              Kliknij ponizej, aby zapisac potwierdzenie na podstawie wpisanego
              {usesGuestList ? ' numeru telefonu' : ' kontaktu i imienia'}.
            </p>
            <button className="button secondary" type="button" onClick={onConfirmVerification}>
              Potwierdz tozsamosc
            </button>
          </div>
        ) : null}
      </form>

      <form className="form-card" onSubmit={onRequestReservation}>
        <h3>2. Zglos rezerwacje</h3>
        <label>
          Prezent
          <select
            value={selectedGiftId}
            onChange={(event) => onSelectedGiftChange(event.target.value)}
          >
            {planner.gifts.map((gift) => (
              <option key={gift.id} value={gift.id}>
                {gift.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          Wiadomosc dla organizatora
          <textarea
            value={reservationMessage}
            onChange={(event) => onReservationMessageChange(event.target.value)}
            placeholder="np. Kupie ten prezent razem z paragonem do wymiany."
          />
        </label>
        <button className="button primary" disabled={!verifiedGuest || !planner.gifts.length} type="submit">
          Zglos do zatwierdzenia
        </button>
      </form>

      <form className="form-card" onSubmit={onSubmitRsvp}>
        <h3>3. Potwierdz obecnosc</h3>
        <label>
          Czy bedziecie?
          <select
            value={attendanceStatus}
            onChange={(event) => onAttendanceStatusChange(event.target.value as AttendanceStatus)}
          >
            <option value="yes">Tak, bedziemy</option>
            <option value="maybe">Jeszcze nie wiem</option>
            <option value="no">Nie bedzie nas</option>
          </select>
        </label>
        <div className="mini-grid">
          <label>
            Dorosli
            <input
              min="0"
              type="number"
              value={attendanceAdults}
              onChange={(event) => onAttendanceAdultsChange(Number(event.target.value))}
            />
          </label>
          <label>
            Dzieci
            <input
              min="0"
              type="number"
              value={attendanceChildren}
              onChange={(event) => onAttendanceChildrenChange(Number(event.target.value))}
            />
          </label>
        </div>
        <label>
          Notatka dla organizatora
          <textarea
            value={attendanceNote}
            onChange={(event) => onAttendanceNoteChange(event.target.value)}
            placeholder="np. Przyjdziemy we dwoje, ale mozemy sie spoznic 15 minut."
          />
        </label>
        <button className="button primary" disabled={!verifiedGuest} type="submit">
          Zapisz obecnosc
        </button>
      </form>
    </div>
  )
}
