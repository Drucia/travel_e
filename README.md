# Ewidencja

Aplikacja mobilna do ewidencji treningów, meczów i dojazdów. Po wydarzeniu zapisujesz, czy byłaś, czy jechałaś i ile wraca do rozliczenia.

Dane zostają na telefonie (SQLite). Nie ma kont ani współdzielenia między użytkownikami.

## Co robi

- **Kalendarz** — treningi i mecze w miesiącu, szybkie dodanie wydarzenia
- **Harmonogram** — stałe dni tygodnia; aplikacja sama dopisuje je w kalendarzu
- **Uzupełnienie dojazdu** — obecność, wyjazd, samochód lub inny transport, tam / powrót / obie strony
- **Miejsca i stawki** — np. 30 zł tam i z powrotem; jedna strona to połowa
- **Dashboard** — liczba wyjazdów i kwota do rozliczenia w miesiącu
- **Sezony** — aktywny sezon plus historia poprzednich
- **Przypomnienia** — powiadomienie po godzinie zakończenia, z przejściem do formularza

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

Powiadomienia działają na telefonie, nie w przeglądarce.

## Stack

- Expo (React Native) i Expo Router
- TypeScript
- SQLite (`expo-sqlite`) — baza `ewidencja.db`
- `expo-notifications` — przypomnienia po treningu lub meczu

## Licencja

MIT (szablon Expo).
