import * as Crypto from 'expo-crypto';

export function createId(): string {
  return Crypto.randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}
