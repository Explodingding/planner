export function EventSummary({
  childName,
  date,
  place,
  giftCount,
  pendingCount,
  approvedCount,
  confirmedCount,
  isRemote,
  formatDate,
}: {
  childName: string
  date: string
  place: string
  giftCount: number
  pendingCount: number
  approvedCount: number
  confirmedCount: number
  isRemote: boolean
  formatDate: (value: string) => string
}) {
  return (
    <div className="event-card">
      <span className="card-label">{isRemote ? 'Wydarzenie online' : 'Nowe wydarzenie'}</span>
      <h2>{childName ? `Urodziny: ${childName}` : 'Utworz wydarzenie'}</h2>
      <p>{formatDate(date)}</p>
      <p>{place || 'Miejsce do uzupelnienia'}</p>
      <div className="status-row">
        <span>{giftCount} pomysly</span>
        <span>{pendingCount} oczekuje</span>
        <span>{approvedCount} zatwierdzone</span>
        <span>{confirmedCount} potwierdzone</span>
      </div>
    </div>
  )
}
