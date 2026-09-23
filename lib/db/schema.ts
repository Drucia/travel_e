import { Platform } from 'react-native';
import type { SQLiteDatabase } from 'expo-sqlite';

import { currentSeasonWindow } from '@/lib/dates';
import { createId, nowIso } from '@/lib/id';
import { DEFAULT_SETTINGS } from '@/lib/db/types';

const DATABASE_VERSION = 5;

export async function migrateDbIfNeeded(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA foreign_keys = ON');
  if (Platform.OS !== 'web') {
    try {
      await db.execAsync('PRAGMA journal_mode = WAL');
    } catch {
      // Some SQLite builds reject WAL; the rest of the schema can still load.
    }
  }

  await ensureCoreSchema(db);
  await ensureMissingColumns(db);
  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
  await seedIfEmpty(db);
}

async function ensureCoreSchema(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS seasons (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS destinations (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      address TEXT,
      distance REAL NOT NULL DEFAULT 0,
      distance_type TEXT NOT NULL DEFAULT 'round_trip' CHECK (distance_type IN ('one_way', 'round_trip')),
      round_trip_rate REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY NOT NULL,
      season_id TEXT NOT NULL,
      date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT,
      type TEXT NOT NULL CHECK (type IN ('training', 'match')),
      destination_id TEXT,
      attended INTEGER,
      traveled INTEGER,
      transport TEXT CHECK (transport IN ('car', 'other') OR transport IS NULL),
      arrived INTEGER,
      trip_direction TEXT CHECK (trip_direction IN ('round_trip', 'outbound', 'return') OR trip_direction IS NULL),
      notes TEXT,
      absence_note TEXT,
      completed INTEGER NOT NULL DEFAULT 0,
      notification_id TEXT,
      source TEXT NOT NULL DEFAULT 'manual',
      schedule_rule_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE RESTRICT,
      FOREIGN KEY (destination_id) REFERENCES destinations(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS schedule_rules (
      id TEXT PRIMARY KEY NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('training', 'match')),
      weekdays TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT,
      destination_id TEXT,
      notes TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (destination_id) REFERENCES destinations(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS schedule_skips (
      id TEXT PRIMARY KEY NOT NULL,
      schedule_rule_id TEXT NOT NULL,
      date TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE (schedule_rule_id, date),
      FOREIGN KEY (schedule_rule_id) REFERENCES schedule_rules(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);
    CREATE INDEX IF NOT EXISTS idx_events_season ON events(season_id);
    CREATE INDEX IF NOT EXISTS idx_events_completed ON events(completed);
  `);
}

async function ensureMissingColumns(db: SQLiteDatabase): Promise<void> {
  const destinationColumns = await columnNames(db, 'destinations');
  if (!destinationColumns.has('round_trip_rate')) {
    await db.execAsync('ALTER TABLE destinations ADD COLUMN round_trip_rate REAL NOT NULL DEFAULT 0');
  }

  const eventColumns = await columnNames(db, 'events');
  if (!eventColumns.has('trip_direction')) {
    await db.execAsync('ALTER TABLE events ADD COLUMN trip_direction TEXT');
    await db.runAsync(
      `UPDATE events SET trip_direction = 'round_trip' WHERE traveled = 1 AND trip_direction IS NULL`
    );
  }
  if (!eventColumns.has('source')) {
    await db.execAsync(`ALTER TABLE events ADD COLUMN source TEXT NOT NULL DEFAULT 'manual'`);
  }
  if (!eventColumns.has('schedule_rule_id')) {
    await db.execAsync('ALTER TABLE events ADD COLUMN schedule_rule_id TEXT');
  }

  const scheduleColumns = await columnNames(db, 'schedule_rules');
  if (!scheduleColumns.has('notes')) {
    await db.execAsync('ALTER TABLE schedule_rules ADD COLUMN notes TEXT');
  }
}

async function columnNames(db: SQLiteDatabase, table: string): Promise<Set<string>> {
  const rows = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  return new Set(rows.map((row) => row.name));
}

async function seedIfEmpty(db: SQLiteDatabase): Promise<void> {
  const seasonCount = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) as c FROM seasons');
  if ((seasonCount?.c ?? 0) === 0) {
    const season = currentSeasonWindow();
    const now = nowIso();
    await db.runAsync(
      `INSERT INTO seasons (id, name, start_date, end_date, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, 1, ?, ?)`,
      createId(),
      season.name,
      season.startDate,
      season.endDate,
      now,
      now
    );
  }

  const defaults: Record<string, string> = {
    reminderEnabled: DEFAULT_SETTINGS.reminderEnabled ? '1' : '0',
    reminderTime: DEFAULT_SETTINGS.reminderTime,
    reminderOffsetMinutes: String(DEFAULT_SETTINGS.reminderOffsetMinutes),
    kilometerRate: String(DEFAULT_SETTINGS.kilometerRate),
    defaultDurationMinutes: String(DEFAULT_SETTINGS.defaultDurationMinutes),
  };

  for (const [key, value] of Object.entries(defaults)) {
    await db.runAsync('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', key, value);
  }
}
