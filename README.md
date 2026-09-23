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

## Stack

- Expo (React Native) i Expo Router
- TypeScript
- SQLite (`expo-sqlite`) — sezony, miejsca, kalendarz i dojazdy
- `expo-notifications` — przypomnienia po treningu lub meczu

## Licencja

MIT (szablon Expo).
