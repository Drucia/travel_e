import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { backupFileName, parseBackup, stringifyBackup, type BackupFile } from '@/lib/backupFormat';

const DEVICE_BACKUP_URI = `${FileSystem.documentDirectory ?? ''}ewidencja-backup.json`;

export async function saveDeviceCopy(backup: BackupFile): Promise<void> {
  try {
    if (!FileSystem.documentDirectory) return;
    await FileSystem.writeAsStringAsync(DEVICE_BACKUP_URI, stringifyBackup(backup));
  } catch (error) {
    console.warn('Nie udało się zapisać kopii na urządzeniu', error);
  }
}

export async function loadDeviceCopy(): Promise<BackupFile | null> {
  if (!FileSystem.documentDirectory) return null;
  const info = await FileSystem.getInfoAsync(DEVICE_BACKUP_URI);
  if (!info.exists) return null;
  return parseBackup(await FileSystem.readAsStringAsync(DEVICE_BACKUP_URI));
}

export async function downloadOrShareBackup(backup: BackupFile): Promise<void> {
  const json = stringifyBackup(backup);
  const name = backupFileName(new Date(backup.exportedAt));
  const dir = FileSystem.cacheDirectory;
  if (!dir) throw new Error('Brak dostępu do plików na tym urządzeniu.');
  const uri = `${dir}${name}`;
  await FileSystem.writeAsStringAsync(uri, json);
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Udostępnianie plików jest niedostępne.');
  }
  await Sharing.shareAsync(uri, {
    mimeType: 'application/json',
    dialogTitle: 'Zapisz kopię ewidencji',
    UTI: 'public.json',
  });
}

export async function pickBackupFile(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/plain'],
    copyToCacheDirectory: true,
  });
  if (result.canceled || !result.assets[0]) return null;
  return FileSystem.readAsStringAsync(result.assets[0].uri);
}
