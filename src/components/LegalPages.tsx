import type { ReactNode } from 'react'

/**
 * Statyczne podstrony prawne: /regulamin i /prywatnosc.
 * UWAGA: pola oznaczone [DO UZUPEŁNIENIA] wymagają danych operatora serwisu.
 */

const OPERATOR_NAME = '[DO UZUPEŁNIENIA: imię i nazwisko / nazwa firmy operatora]'
const OPERATOR_CONTACT_EMAIL = 'kontakt@listaprezentow.pl'
const LAST_UPDATED = '9 czerwca 2026'

function LegalShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="app-shell legal-shell">
      <header className="app-topbar glass-panel">
        <div className="app-brand">
          <span className="app-logo" aria-hidden>
            🎁
          </span>
          <div>
            <p className="app-brand-title">Lista Prezentów</p>
            <p className="app-brand-sub">{title}</p>
          </div>
        </div>
        <nav className="app-tabs">
          <a className="app-tab" href="/">
            Wróć do strony głównej
          </a>
        </nav>
      </header>
      <section className="panel glass-panel legal-page">
        <h1>{title}</h1>
        <p className="legal-updated">Ostatnia aktualizacja: {LAST_UPDATED}</p>
        {children}
      </section>
      <section className="footer-panel glass-panel">
        <p className="footer-legal">
          <a href="/regulamin">Regulamin</a> · <a href="/prywatnosc">Polityka prywatności</a>
        </p>
      </section>
    </main>
  )
}

export function TermsPage() {
  return (
    <LegalShell title="Regulamin serwisu">
      <h2>§1. Postanowienia ogólne</h2>
      <ol>
        <li>
          Serwis Lista Prezentów (dalej: „Serwis”) jest prowadzony przez {OPERATOR_NAME}, kontakt:{' '}
          <a href={`mailto:${OPERATOR_CONTACT_EMAIL}`}>{OPERATOR_CONTACT_EMAIL}</a> (dalej:
          „Usługodawca”).
        </li>
        <li>
          Regulamin określa zasady korzystania z Serwisu, w tym z odpłatnej usługi utworzenia
          wydarzenia online.
        </li>
      </ol>

      <h2>§2. Definicje</h2>
      <ol>
        <li>
          <strong>Organizator</strong> — osoba tworząca wydarzenie (listę prezentów, listę gości i
          potwierdzenia obecności).
        </li>
        <li>
          <strong>Gość</strong> — osoba korzystająca z publicznego linku wydarzenia w celu
          rezerwacji prezentu lub potwierdzenia obecności.
        </li>
        <li>
          <strong>Wydarzenie online</strong> — zapisany na serwerach Serwisu zestaw danych
          wydarzenia dostępny pod unikalnymi linkami: publicznym (dla Gości) i prywatnym (dla
          Organizatora).
        </li>
      </ol>

      <h2>§3. Zakres usług i ceny</h2>
      <ol>
        <li>
          Korzystanie z wersji roboczej (szkic na stronie głównej, dane zapisywane wyłącznie w
          przeglądarce użytkownika) jest bezpłatne.
        </li>
        <li>
          Utworzenie wydarzenia online jest odpłatne i kosztuje <strong>5 zł brutto</strong>{' '}
          (opłata jednorazowa). Cena zawiera wszystkie podatki.
        </li>
        <li>
          W ramach opłaty Organizator otrzymuje: zapis wydarzenia na serwerach Serwisu, publiczny
          link do udostępnienia Gościom oraz prywatny link do panelu zarządzania.
        </li>
      </ol>

      <h2>§4. Płatności</h2>
      <ol>
        <li>
          Płatności obsługuje zewnętrzny operator płatności Stripe. Usługodawca nie przechowuje
          danych kart płatniczych.
        </li>
        <li>
          Umowa o świadczenie usługi zostaje zawarta z chwilą dokonania płatności. Wydarzenie
          online jest tworzone niezwłocznie po potwierdzeniu płatności.
        </li>
      </ol>

      <h2>§5. Odstąpienie od umowy</h2>
      <ol>
        <li>
          Usługa polega na dostarczeniu treści/usługi cyfrowej, której spełnianie rozpoczyna się —
          za wyraźną zgodą konsumenta — natychmiast po dokonaniu płatności, przed upływem terminu
          do odstąpienia od umowy.
        </li>
        <li>
          Dokonując płatności, konsument żąda natychmiastowego wykonania usługi i przyjmuje do
          wiadomości, że po pełnym wykonaniu usługi (utworzeniu wydarzenia online) traci prawo
          odstąpienia od umowy (art. 38 ust. 1 pkt 1 i 13 ustawy o prawach konsumenta).
        </li>
        <li>
          Jeżeli wydarzenie online nie zostało utworzone mimo dokonania płatności, Organizatorowi
          przysługuje zwrot pełnej opłaty — prosimy o kontakt na adres{' '}
          <a href={`mailto:${OPERATOR_CONTACT_EMAIL}`}>{OPERATOR_CONTACT_EMAIL}</a>.
        </li>
      </ol>

      <h2>§6. Zasady korzystania</h2>
      <ol>
        <li>
          Dostęp do panelu Organizatora zapewnia prywatny link z tokenem. Organizator zobowiązuje
          się nie udostępniać prywatnego linku osobom nieuprawnionym; Usługodawca nie odpowiada za
          skutki udostępnienia tego linku przez Organizatora.
        </li>
        <li>
          Zabronione jest umieszczanie w Serwisie treści bezprawnych, obraźliwych lub naruszających
          prawa osób trzecich.
        </li>
        <li>
          Organizator wprowadzający dane Gości (imiona, numery telefonów) oświadcza, że jest
          uprawniony do ich podania i poinformował te osoby o przetwarzaniu ich danych w Serwisie.
        </li>
      </ol>

      <h2>§7. Dostępność i odpowiedzialność</h2>
      <ol>
        <li>
          Usługodawca dokłada starań, aby Serwis działał nieprzerwanie, ale nie gwarantuje
          dostępności 100% czasu (prace techniczne, awarie dostawców infrastruktury).
        </li>
        <li>
          Wydarzenia online są przechowywane co najmniej do dnia wydarzenia; po tym terminie mogą
          zostać zarchiwizowane lub usunięte.
        </li>
      </ol>

      <h2>§8. Reklamacje</h2>
      <ol>
        <li>
          Reklamacje można składać na adres{' '}
          <a href={`mailto:${OPERATOR_CONTACT_EMAIL}`}>{OPERATOR_CONTACT_EMAIL}</a>. Odpowiedź
          zostanie udzielona w terminie 14 dni.
        </li>
      </ol>

      <h2>§9. Dane osobowe</h2>
      <p>
        Zasady przetwarzania danych osobowych opisuje{' '}
        <a href="/prywatnosc">Polityka prywatności</a>.
      </p>

      <h2>§10. Postanowienia końcowe</h2>
      <ol>
        <li>
          Usługodawca może zmienić Regulamin z ważnych przyczyn; zmiany nie dotyczą usług już
          opłaconych.
        </li>
        <li>W sprawach nieuregulowanych stosuje się prawo polskie.</li>
      </ol>
    </LegalShell>
  )
}

export function PrivacyPage() {
  return (
    <LegalShell title="Polityka prywatności">
      <h2>1. Administrator danych</h2>
      <p>
        Administratorem danych osobowych jest {OPERATOR_NAME}, kontakt:{' '}
        <a href={`mailto:${OPERATOR_CONTACT_EMAIL}`}>{OPERATOR_CONTACT_EMAIL}</a>.
      </p>

      <h2>2. Jakie dane przetwarzamy</h2>
      <ul>
        <li>
          <strong>Dane Organizatora:</strong> imię oraz e-mail lub numer telefonu — podawane przy
          tworzeniu wydarzenia online.
        </li>
        <li>
          <strong>Dane Gości:</strong> imiona i numery telefonów — wprowadzane przez Organizatora
          (lista zaproszonych) lub przez Gościa (rezerwacja prezentu, potwierdzenie obecności,
          liczba osób, opcjonalna wiadomość).
        </li>
        <li>
          <strong>Dane płatności:</strong> obsługiwane w całości przez Stripe; nie przechowujemy
          danych kart płatniczych.
        </li>
      </ul>

      <h2>3. Cele i podstawy prawne</h2>
      <ul>
        <li>
          Świadczenie usługi (utworzenie i obsługa wydarzenia online) — art. 6 ust. 1 lit. b RODO.
        </li>
        <li>Rozliczenia i obowiązki podatkowe — art. 6 ust. 1 lit. c RODO.</li>
        <li>
          Anonimowa statystyka korzystania z Serwisu (zliczanie zdarzeń bez identyfikatorów
          użytkownika i bez cookies) — art. 6 ust. 1 lit. f RODO (uzasadniony interes: rozwój
          Serwisu).
        </li>
      </ul>

      <h2>4. Odbiorcy danych</h2>
      <ul>
        <li>
          <strong>Netlify</strong> (hosting i przechowywanie danych wydarzeń) — dane mogą być
          przetwarzane na serwerach poza EOG na podstawie standardowych klauzul umownych.
        </li>
        <li>
          <strong>Stripe</strong> (obsługa płatności).
        </li>
      </ul>

      <h2>5. Okres przechowywania</h2>
      <p>
        Dane wydarzenia przechowujemy przez czas potrzebny do obsługi wydarzenia. Wydarzenia mogą
        być archiwizowane lub usuwane po dacie imprezy. Organizator może w każdej chwili zażądać
        usunięcia wydarzenia, pisząc na adres{' '}
        <a href={`mailto:${OPERATOR_CONTACT_EMAIL}`}>{OPERATOR_CONTACT_EMAIL}</a>.
      </p>

      <h2>6. Dane Gości wprowadzane przez Organizatora</h2>
      <p>
        Organizator, dodając do listy zaproszonych dane innych osób, odpowiada za poinformowanie
        ich o przetwarzaniu danych w Serwisie. W widoku publicznym numery telefonów Gości są
        maskowane (widoczne są tylko ostatnie cyfry).
      </p>

      <h2>7. Prawa osób, których dane dotyczą</h2>
      <p>
        Każdej osobie przysługuje prawo dostępu do danych, ich sprostowania, usunięcia,
        ograniczenia przetwarzania, sprzeciwu oraz wniesienia skargi do Prezesa UODO. W celu
        realizacji praw prosimy o kontakt:{' '}
        <a href={`mailto:${OPERATOR_CONTACT_EMAIL}`}>{OPERATOR_CONTACT_EMAIL}</a>.
      </p>

      <h2>8. Cookies i pamięć przeglądarki</h2>
      <p>
        Serwis nie używa cookies śledzących ani reklamowych. Pamięć przeglądarki (localStorage,
        sessionStorage) służy wyłącznie do celów technicznych: zapisu szkicu wydarzenia na stronie
        głównej oraz obsługi powrotu z płatności.
      </p>
    </LegalShell>
  )
}
