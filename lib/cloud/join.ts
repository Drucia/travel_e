import * as Crypto from 'expo-crypto';

const JOIN_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function randomJoinCode(): string {
  const bytes = Crypto.getRandomBytes(6);
  return Array.from(bytes, (byte) => JOIN_ALPHABET[byte % JOIN_ALPHABET.length]).join('');
}

export function sanitizeJoinCode(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
}

export function parseJoinCodeFromUrl(url: string): string | null {
  const withProtocol = url.includes('://') ? url : `https://${url}`;
  const normalized = withProtocol.replace(/^ewidencja:/i, 'https://ewidencja.app');
  try {
    const parsed = new URL(normalized);
    const fromQuery = parsed.searchParams.get('code');
    if (fromQuery) return sanitizeJoinCode(fromQuery);

    const parts = parsed.pathname.split('/').filter(Boolean);
    const joinIndex = parts.findIndex((part) => part.toLowerCase() === 'join');
    if (joinIndex >= 0 && parts[joinIndex + 1]) {
      return sanitizeJoinCode(parts[joinIndex + 1]);
    }
    if (parsed.hostname.toLowerCase() === 'join' && parts[0]) {
      return sanitizeJoinCode(parts[0]);
    }
  } catch {
    return null;
  }
  return null;
}

export function inviteMessage(groupName: string, joinCode: string): string {
  return `Dołącz do grupy „${groupName}” w aplikacji Ewidencja.\nKod: ${joinCode}\nLink: ewidencja://join/${joinCode}`;
}
