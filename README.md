# Ewidencja

Aplikacja do ewidencji treningów, meczów i dojazdów. Po wydarzeniu zapisujesz, czy byłaś, czy jechałaś i ile wraca do rozliczenia.

Wszystko jest **tylko na tym urządzeniu** (SQLite). Nie ma konta, logowania ani grup.

## Co robi

- **Kalendarz** — treningi i mecze
- **Harmonogram** — stałe dni; aplikacja dopisuje je w kalendarzu
- **Uzupełnienie dojazdu** — obecność, wyjazd, samochód lub inny transport, tam / powrót / obie strony
- **Miejsca i stawki** — np. 30 zł tam i z powrotem
- **Dashboard** — obecność i kwoty do rozliczenia
- **Sezony** — aktywny sezon plus historia
- **Kopia zapasowa** — zapis do pliku JSON (iCloud / Pobrane) oraz automatyczna kopia na urządzeniu
- **Przypomnienia** — lokalne powiadomienie po godzinie zakończenia (na telefonie, nie w przeglądarce)

## Uruchomienie

Wymagania: Node.js 20.19.4 lub nowszy, [Expo Go](https://expo.dev/go) na telefonie.

```bash
npm install
npm start
```

Zeskanuj kod QR w Expo Go (Android) albo aparatem (iOS).

Inne warianty:

```bash
npm run android   # emulator / urządzenie Android
npm run ios       # simulator iOS (macOS)
npm run web       # podgląd w przeglądarce
```

Na WSL2 telefon często nie widzi serwera w LAN — wtedy otwórz podgląd w przeglądarce: http://localhost:8081

## PWA (ikona na pulpicie)

Wersja web jest aplikacją PWA.

- **Komputer (Chrome / Edge):** otwórz http://localhost:8081 → ikona instalacji w pasku adresu albo Menu → Zainstaluj aplikację.
- **iPhone:** otwórz https://drucia.github.io/travel_e/ w Safari → Udostępnij → Dodaj do ekranu początkowego.

Adres na stałe: https://drucia.github.io/travel_e/ (GitHub Pages). Komputer nie musi być włączony.

Pierwsze włączenie (jednorazowo w GitHubie):

1. Jeśli repo jest prywatne: [Settings](https://github.com/Drucia/travel_e/settings) → **Change repository visibility → Public** (w apce nie ma Twoich dojazdów, tylko kod). Na darmowym koncie Pages działa tylko dla publicznych repo.
2. [Pages](https://github.com/Drucia/travel_e/settings/pages) → **Source: Deploy from a branch** (nie „GitHub Actions”) → Branch **`master`** / folder **`/docs`** → Save.

Instrukcja jest też w Ustawieniach apki.

W **Ustawieniach** jest kopia zapasowa: „Zapisz do pliku” (JSON) i „Wczytaj z pliku”. Na iPhonie w udostępnianiu wybierz Pliki → iCloud Drive. Aplikacja sama też odkłada kopię na urządzeniu przy każdym odświeżeniu danych.

## Stack

- Expo (React Native) i Expo Router
- TypeScript
- SQLite (`expo-sqlite`) — sezony, miejsca, kalendarz i dojazdy
- `expo-notifications` — przypomnienia po treningu lub meczu

## Licencja

MIT (szablon Expo).
