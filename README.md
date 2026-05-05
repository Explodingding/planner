# Prezentownik MVP

Pierwszy prototyp webowego plannera prezentow i wydarzenia dla grupy rodzicow.

## Co dziala

- opis wydarzenia: dziecko, termin, miejsce, temat i informacje organizacyjne,
- lista pomyslow na prezenty ze statusem,
- symulowane logowanie bez hasla przez e-mail lub telefon,
- potwierdzanie obecnosci: tak / nie / jeszcze nie wiem,
- aktualna lista obecnosci z liczba doroslych i dzieci,
- zgloszenie rezerwacji prezentu przez rodzica,
- zatwierdzanie albo odrzucanie rezerwacji przez organizatora,
- oznaczanie zatwierdzonej rezerwacji jako kupionej,
- link do udostepnienia i przycisk WhatsApp,
- zapis danych lokalnie w przegladarce przez `localStorage`.

## Uruchomienie

```bash
npm install
npm run dev
```

## Sprawdzenie

```bash
npm run lint
npm run build
```

## Netlify

Projekt ma konfiguracje `netlify.toml`.

Ustawienia deploya:

- build command: `npm run build`,
- publish directory: `dist`.

Taki deploy wystarczy do pokazania prototypu UI. Wspolna lista dla wielu rodzicow wymaga kolejnego kroku: Netlify Functions oraz magazynu danych, np. Netlify Blobs albo zewnetrznej bazy typu Supabase.

## Notatki produktowe

To jeszcze nie jest wersja produkcyjna. Wysylka e-mail/SMS, konta organizatorow i baza danych sa celowo zastapione symulacja frontendowa, zeby szybko zweryfikowac sam przeplyw MVP.

Najblizszy krok techniczny po walidacji UI to backend w Netlify Functions z prawdziwymi wydarzeniami, tokenami organizatora, magic linkami i trwalym zapisem obecnosci oraz rezerwacji.
