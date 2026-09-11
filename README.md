# Ewidencja

Aplikacja mobilna do ewidencji treningów, meczów i dojazdów. Po wydarzeniu zapisujesz, czy byłaś, czy jechałaś i ile wraca do rozliczenia.

Wspólne dane grupy (sezony, miejsca, harmonogram, kalendarz) są w chmurze **Supabase (plan Free)** — bez własnego serwera. Obecność i dojazd są **osobiste**: każda osoba uzupełnia swoje odpowiedzi, nikt nie nadpisuje drugiej.

Powiadomienia po treningu zostają lokalnie na telefonie.

## Co robi

- **Konto** — rejestracja i logowanie e-mail + hasło
- **Grupa dojazdowa** — utwórz grupę albo dołącz kodem / linkiem `ewidencja://join/KOD`
- **Kalendarz** — wspólne treningi i mecze w wybranej grupie
- **Harmonogram** — stałe dni; aplikacja dopisuje je w kalendarzu grupy
- **Uzupełnienie dojazdu** — Twoja obecność, wyjazd, samochód lub inny transport, tam / powrót / obie strony
- **Miejsca i stawki** — wspólna lista, np. 30 zł tam i z powrotem
- **Dashboard** — najpierw Twoje kwoty, potem podgląd grupy
- **Sezony** — aktywny sezon plus historia
- **Przypomnienia** — lokalne powiadomienie po godzinie zakończenia (na telefonie, nie w przeglądarce)

## Uruchomienie

Wymagania: Node.js 20.19.4 lub nowszy, [Expo Go](https://expo.dev/go) na telefonie.

```bash
npm install
cp .env.example .env
# uzupełnij .env (patrz niżej)
npm start
```

Zeskanuj kod QR w Expo Go (Android) albo aparatem (iOS).

Inne warianty:

```bash
npm run android   # emulator / urządzenie Android
npm run ios       # simulator iOS (macOS)
npm run web       # podgląd w przeglądarce
```

## Supabase (darmowy projekt)

Nie trzeba App Store, VPS ani karty. Załóż darmowe konto na [supabase.com](https://supabase.com).

### 1. Nowy projekt

1. New project — nazwa dowolna, hasło bazy zapisz u siebie.
2. Region najbliższy (np. Frankfurt).
3. Plan **Free**. Poczekaj, aż projekt wstanie (ok. 1–2 minuty).

### 2. URL i anon key

1. Project Settings → **API**.
2. Skopiuj **Project URL** i klucz **anon public** (nie `service_role`).
3. W folderze aplikacji:

```bash
cp .env.example .env
```

4. Wklej wartości:

```
EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
# albo starszy anon JWT:
# EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

Pliku `.env` nie commituj — jest w `.gitignore`.

### 3. Tabele i uprawnienia (SQL)

1. W panelu: **SQL Editor** → New query.
2. Wklej całość pliku `supabase/schema.sql`.
3. **Run**.

To tworzy tabele (grupy, sezony, miejsca, wydarzenia, `event_responses`) i włącza RLS: widzisz tylko grupy, do których należysz; dojazd zapisujesz tylko swój.

### 4. Logowanie e-mail

W Authentication → Providers → Email:

- Zostaw e-mail + hasło włączone.
- Na start wygodnie **wyłączyć Confirm email** (inaczej każda osoba musi kliknąć link w skrzynce). SMS nie jest potrzebny.

Site URL możesz zostawić domyślny. Aplikacja loguje hasłem, bez magicznych linków.

### 5. Restart aplikacji

Po zapisaniu `.env` zrestartuj `npm start`. W apce: rejestracja → utwórz grupę albo wklej kod.

## Świadome ograniczenia (Free)

- Projekt może się **uśpić po około 7 dniach bez użycia**. Wejdź na supabase.com i otwórz projekt, żeby go obudzić; pierwsze zapytanie bywa wolniejsze.
- Brak SMS / logowania telefonem — tylko e-mail i hasło.
- Apka jest **online-first**: bez internetu nie wczyta kalendarza grupy (jest komunikat). SQLite zostaje na telefonie tylko do ustawień powiadomień.
- Powiadomienia są lokalne na urządzeniu, nie push z chmury.
- Limit Free (m.in. baza i transfer) wystarcza na małą grupę dojazdową; nie nadaje się jako nieskończony hosting.

Lokalne dane z poprzedniej wersji (tylko telefon, `ewidencja.db`) **nie migrują automatycznie** do chmury. Po założeniu grupy dopisz sezony, miejsca i harmonogram od nowa — będą wspólne.

## Stack

- Expo (React Native) i Expo Router
- TypeScript
- Supabase (Auth + Postgres) — źródło prawdy dla grupy
- SQLite (`expo-sqlite`) — lokalne ustawienia przypomnień
- `expo-notifications` — przypomnienia po treningu lub meczu

## Licencja

MIT (szablon Expo).
