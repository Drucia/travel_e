export class CloudError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CloudError';
  }
}

export function cloudErrorMessage(error: unknown): string {
  const raw =
    error && typeof error === 'object' && 'message' in error
      ? String((error as { message: unknown }).message)
      : error instanceof Error
        ? error.message
        : String(error);
  const lower = raw.toLowerCase();

  if (
    lower.includes('failed to fetch') ||
    lower.includes('network request failed') ||
    lower.includes('network error') ||
    lower.includes('internet') ||
    lower.includes('timeout')
  ) {
    return 'Brak połączenia z internetem. Dane grupy są w chmurze — połącz się z siecią i spróbuj ponownie.';
  }
  if (lower.includes('invalid login credentials') || lower.includes('invalid_credentials')) {
    return 'Nieprawidłowy e-mail lub hasło.';
  }
  if (lower.includes('user already registered') || lower.includes('already been registered')) {
    return 'Ten e-mail jest już zarejestrowany. Zaloguj się.';
  }
  if (lower.includes('email not confirmed')) {
    return 'Potwierdź adres e-mail albo w panelu Supabase wyłącz „Confirm email”.';
  }
  if (lower.includes('password should be') || lower.includes('password is known')) {
    return 'Hasło jest za słabe. Użyj co najmniej 6 znaków.';
  }
  if (lower.includes('nie znaleziono grupy')) {
    return 'Nie znaleziono grupy o tym kodzie.';
  }
  if (lower.includes('nie zalogowano')) {
    return 'Sesja wygasła. Zaloguj się ponownie.';
  }
  if (lower.includes('jwt') || lower.includes('not authenticated')) {
    return 'Sesja wygasła. Zaloguj się ponownie.';
  }
  if (lower.includes('row-level security') || lower.includes('violates row-level')) {
    return 'Brak uprawnień do tej grupy.';
  }

  return raw || 'Nie udało się połączyć z chmurą.';
}
