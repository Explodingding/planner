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
- tworzenie wydarzenia online z unikalnym linkiem `/event/:id`,
- prywatny panel organizatora pod `/manage/:id?token=...`,
- Netlify Functions jako API,
- Netlify Blobs jako prosty storage wydarzen,
- link do udostepnienia i przycisk WhatsApp,
- lokalne demo przez `localStorage` na stronie glownej.

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
- publish directory: `dist`,
- functions directory: `netlify/functions`.

Po deployu strona glowna dziala jako demo. Klikniecie `Utworz wydarzenie online` zapisuje event w Netlify Blobs i przekierowuje organizatora na prywatny link zarzadzania. Link publiczny mozna udostepnic rodzicom.

## Notatki produktowe

To nadal MVP. Wysylka e-mail/SMS jest symulowana frontendowo, a prywatny dostep organizatora opiera sie na tokenie w linku. To wystarcza do pierwszych testow, ale przed szerszym uzyciem warto dodac prawdziwe magic linki i lepsza obsluge konfliktow rownoczesnych zapisow.

Najblizszy krok techniczny po walidacji UI to prawdziwe magic linki oraz bezpieczniejsze zapisy z ETag/conditional writes w Netlify Blobs.
