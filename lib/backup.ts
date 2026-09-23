import type { SQLiteDatabase } from 'expo-sqlite';

import {
  BACKUP_VERSION,
  type BackupFile,
  type DeviceBackupInfo,
  backupFileName,
  deviceBackupInfo,
  parseBackup,
  stringifyBackup,
} from '@/lib/backupFormat';
import { nowIso } from '@/lib/id';

export {
  BACKUP_VERSION,
  backupFileName,
  deviceBackupInfo,
  parseBackup,
  stringifyBackup,
};
export type { BackupFile, DeviceBackupInfo };

export async function createBackup(db: SQLiteDatabase): Promise<BackupFile> {
  const [seasons, destinations, scheduleRules, scheduleSkips, events, settings] = await Promise.all([
    db.getAllAsync<Record<string, unknown>>('SELECT * FROM seasons ORDER BY start_date'),
    db.getAllAsync<Record<string, unknown>>('SELECT * FROM destinations ORDER BY name COLLATE NOCASE'),
    db.getAllAsync<Record<string, unknown>>('SELECT * FROM schedule_rules ORDER BY type, start_time'),
    db.getAllAsync<Record<string, unknown>>('SELECT * FROM schedule_skips ORDER BY date'),
    db.getAllAsync<Record<string, unknown>>('SELECT * FROM events ORDER BY date, start_time'),
    db.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM settings ORDER BY key'),
  ]);

  return {
    app: 'ewidencja',
    version: BACKUP_VERSION,
    exportedAt: nowIso(),
    seasons,
    destinations,
    scheduleRules,
    scheduleSkips,
    events,
    settings,
  };
}

export async function restoreBackup(db: SQLiteDatabase, backup: BackupFile): Promise<void> {
  await db.execAsync('PRAGMA foreign_keys = OFF');
  try {
    await db.withTransactionAsync(async () => {
      await db.execAsync(`
        DELETE FROM events;
        DELETE FROM schedule_skips;
        DELETE FROM schedule_rules;
        DELETE FROM destinations;
        DELETE FROM seasons;
        DELETE FROM settings;
      `);

      for (const row of backup.seasons) {
        await db.runAsync(
          `INSERT INTO seasons (id, name, start_date, end_date, is_active, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          str(row.id),
          str(row.name),
          str(row.start_date),
          str(row.end_date),
          int(row.is_active, 0),
          str(row.created_at, nowIso()),
          str(row.updated_at, nowIso())
        );
      }

      for (const row of backup.destinations) {
        await db.runAsync(
          `INSERT INTO destinations (id, name, address, distance, distance_type, round_trip_rate, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          str(row.id),
          str(row.name),
          nullable(row.address),
          num(row.distance),
          str(row.distance_type, 'round_trip'),
          num(row.round_trip_rate),
          str(row.created_at, nowIso()),
          str(row.updated_at, nowIso())
        );
      }

      for (const row of backup.scheduleRules) {
        await db.runAsync(
          `INSERT INTO schedule_rules (id, type, weekdays, start_time, end_time, destination_id, notes, enabled, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          str(row.id),
          str(row.type),
          str(row.weekdays),
          str(row.start_time),
          nullable(row.end_time),
          nullable(row.destination_id),
          nullable(row.notes),
          int(row.enabled, 1),
          str(row.created_at, nowIso()),
          str(row.updated_at, nowIso())
        );
      }

      for (const row of backup.scheduleSkips) {
        await db.runAsync(
          `INSERT INTO schedule_skips (id, schedule_rule_id, date, created_at) VALUES (?, ?, ?, ?)`,
          str(row.id),
          str(row.schedule_rule_id),
          str(row.date),
          str(row.created_at, nowIso())
        );
      }

      for (const row of backup.events) {
        await db.runAsync(
          `INSERT INTO events (
            id, season_id, date, start_time, end_time, type, destination_id,
            attended, traveled, transport, arrived, trip_direction, notes, absence_note,
            completed, notification_id, source, schedule_rule_id, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          str(row.id),
          str(row.season_id),
          str(row.date),
          str(row.start_time),
          nullable(row.end_time),
          str(row.type),
          nullable(row.destination_id),
          nullInt(row.attended),
          nullInt(row.traveled),
          nullable(row.transport),
          nullInt(row.arrived),
          nullable(row.trip_direction),
          nullable(row.notes),
          nullable(row.absence_note),
          int(row.completed, 0),
          nullable(row.notification_id),
          str(row.source, 'manual'),
          nullable(row.schedule_rule_id),
          str(row.created_at, nowIso()),
          str(row.updated_at, nowIso())
        );
      }

      for (const row of backup.settings) {
        await db.runAsync('INSERT INTO settings (key, value) VALUES (?, ?)', row.key, row.value);
      }
    });
  } finally {
    await db.execAsync('PRAGMA foreign_keys = ON');
  }
}

function str(value: unknown, fallback = ''): string {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function nullable(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  return String(value);
}

function num(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function int(value: unknown, fallback = 0): number {
  if (value === true) return 1;
  if (value === false) return 0;
  if (value === null || value === undefined) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function nullInt(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (value === true) return 1;
  if (value === false) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
