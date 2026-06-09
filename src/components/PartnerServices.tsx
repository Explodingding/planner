import { ORGANIZER_SERVICES } from '../constants'

export function PartnerServices() {
  return (
    <div className="form-card full-width">
      <div className="service-intro">
        <h3>Pomoc w organizacji urodzin</h3>
        <p className="form-hint">
          Polecane serwisy i sklepy — kliknij, zeby przejsc bezposrednio do oferty.
        </p>
      </div>
      <div className="service-grid">
        {ORGANIZER_SERVICES.map((service) => (
          <a
            className="service-card"
            key={service.title}
            href={service.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${service.title} — otworzy sie w nowej karcie`}
          >
            <div className="service-card-header">
              <span className="service-icon" aria-hidden="true">{service.icon}</span>
              <span className="service-tag">{service.tag}</span>
            </div>
            <h4>{service.title}</h4>
            <p>{service.description}</p>
            <span className="service-cta">{service.action} →</span>
          </a>
        ))}
      </div>
    </div>
  )
}
