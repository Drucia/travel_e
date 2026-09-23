import { backupFileName, parseBackup, stringifyBackup, type BackupFile } from '@/lib/backupFormat';

const DEVICE_BACKUP_KEY = 'ewidencja.deviceBackup';

export async function saveDeviceCopy(backup: BackupFile): Promise<void> {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(DEVICE_BACKUP_KEY, stringifyBackup(backup));
}

export async function loadDeviceCopy(): Promise<BackupFile | null> {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(DEVICE_BACKUP_KEY);
  return raw ? parseBackup(raw) : null;
}

export async function downloadOrShareBackup(backup: BackupFile): Promise<void> {
  const json = stringifyBackup(backup);
  const name = backupFileName(new Date(backup.exportedAt));
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function pickBackupFile(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json,text/plain';
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      void file.text().then(resolve).catch(() => resolve(null));
    });
    input.click();
  });
}
