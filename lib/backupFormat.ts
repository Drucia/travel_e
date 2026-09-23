export const BACKUP_VERSION = 1 as const;

export type BackupFile = {
  app: 'ewidencja';
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  seasons: Record<string, unknown>[];
  destinations: Record<string, unknown>[];
  scheduleRules: Record<string, unknown>[];
  events: Record<string, unknown>[];
  settings: { key: string; value: string }[];
};

export type DeviceBackupInfo = {
  exportedAt: string;
  seasons: number;
  events: number;
};

export function backupFileName(exportedAt = new Date()): string {
  return `ewidencja-${exportedAt.toISOString().slice(0, 10)}.json`;
}

export function stringifyBackup(backup: BackupFile): string {
  return `${JSON.stringify(backup, null, 2)}\n`;
}

export function parseBackup(raw: string): BackupFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('To nie jest poprawny plik JSON.');
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Niepoprawna kopia zapasowa.');
  }
  const data = parsed as Partial<BackupFile>;
  if (data.app !== 'ewidencja' || data.version !== BACKUP_VERSION) {
    throw new Error('Ten plik nie pochodzi z Ewidencji albo ma za stary format.');
  }
  if (
    !Array.isArray(data.seasons) ||
    !Array.isArray(data.destinations) ||
    !Array.isArray(data.scheduleRules) ||
    !Array.isArray(data.events) ||
    !Array.isArray(data.settings)
  ) {
    throw new Error('W kopii brakuje tabel.');
  }
  return data as BackupFile;
}

export function deviceBackupInfo(backup: BackupFile | null): DeviceBackupInfo | null {
  if (!backup) return null;
  return {
    exportedAt: backup.exportedAt,
    seasons: backup.seasons.length,
    events: backup.events.length,
  };
}
