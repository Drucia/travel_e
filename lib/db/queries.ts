import type { SQLiteDatabase } from 'expo-sqlite';

import { createId, nowIso } from '@/lib/id';
import { DEFAULT_SETTINGS, type CompletionDraft, type Destination, type DistanceType, type EventDraft, type EventRecord, type EventType, type ScheduleRule, type Season, type Settings, type Transport, type TripDirection } from '@/lib/db/types';

type SeasonRow = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_active: number;
  created_at: string;
  updated_at: string;
};

type DestinationRow = {
  id: string;
  name: string;
  address: string | null;
  distance: number;
  distance_type: DistanceType;
  round_trip_rate: number;
  created_at: string;
  updated_at: string;
};

type EventRow = {
  id: string;
  season_id: string;
  date: string;
  start_time: string;
  end_time: string | null;
  type: EventType;
  destination_id: string | null;
  attended: number | null;
  traveled: number | null;
  transport: Transport | null;
  arrived: number | null;
  trip_direction: TripDirection | null;
  notes: string | null;
  absence_note: string | null;
  completed: number;
  notification_id: string | null;
  source?: 'manual' | 'schedule' | null;
  schedule_rule_id?: string | null;
  created_at: string;
  updated_at: string;
  destination_name?: string | null;
};

type SettingsRow = {
  key: string;
  value: string;
};

const EVENT_SELECT = `
  SELECT e.*, d.name as destination_name
  FROM events e
  LEFT JOIN destinations d ON d.id = e.destination_id
`;

function toBool(value: number | null): boolean | null {
  if (value === null || value === undefined) return null;
  return value === 1;
}

function mapSeason(row: SeasonRow): Season {
  return {
    id: row.id,
    name: row.name,
    startDate: row.start_date,
    endDate: row.end_date,
    active: row.is_active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapDestination(row: DestinationRow): Destination {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    distance: row.distance,
    distanceType: row.distance_type,
    roundTripRate: row.round_trip_rate ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapEvent(row: EventRow): EventRecord {
  return {
    id: row.id,
    seasonId: row.season_id,
    date: row.date,
    startTime: row.start_time,
    endTime: row.end_time,
    type: row.type,
    destinationId: row.destination_id,
    attended: toBool(row.attended),
    traveled: toBool(row.traveled),
    transport: row.transport,
    arrived: toBool(row.arrived),
    tripDirection: row.trip_direction ?? null,
    notes: row.notes,
    absenceNote: row.absence_note,
    completed: row.completed === 1,
    notificationId: row.notification_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    destinationName: row.destination_name ?? null,
  };
}

export async function listSeasons(db: SQLiteDatabase): Promise<Season[]> {
  const rows = await db.getAllAsync<SeasonRow>(
    'SELECT * FROM seasons ORDER BY is_active DESC, start_date DESC'
  );
  return rows.map(mapSeason);
}

export async function getSeason(db: SQLiteDatabase, id: string): Promise<Season | null> {
  const row = await db.getFirstAsync<SeasonRow>('SELECT * FROM seasons WHERE id = ?', id);
  return row ? mapSeason(row) : null;
}

export async function getActiveSeason(db: SQLiteDatabase): Promise<Season | null> {
  const row = await db.getFirstAsync<SeasonRow>('SELECT * FROM seasons WHERE is_active = 1 LIMIT 1');
  return row ? mapSeason(row) : null;
}

export async function createSeason(
  db: SQLiteDatabase,
  input: { name: string; startDate: string; endDate: string; active: boolean }
): Promise<Season> {
  const id = createId();
  const now = nowIso();
  await db.withTransactionAsync(async () => {
    if (input.active) {
      await db.runAsync('UPDATE seasons SET is_active = 0, updated_at = ?', now);
    }
    await db.runAsync(
      `INSERT INTO seasons (id, name, start_date, end_date, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      id,
      input.name.trim(),
      input.startDate,
      input.endDate,
      input.active ? 1 : 0,
      now,
      now
    );
  });
  const created = await getSeason(db, id);
  if (!created) throw new Error('Nie udało się utworzyć sezonu');
  return created;
}

export async function setActiveSeason(db: SQLiteDatabase, id: string): Promise<void> {
  const now = nowIso();
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE seasons SET is_active = 0, updated_at = ?', now);
    await db.runAsync('UPDATE seasons SET is_active = 1, updated_at = ? WHERE id = ?', now, id);
  });
}

export async function deleteSeason(db: SQLiteDatabase, id: string): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM events WHERE season_id = ?', id);
    await db.runAsync('DELETE FROM seasons WHERE id = ?', id);
  });

  const remaining = await listSeasons(db);
  if (remaining.length > 0 && !remaining.some((season) => season.active)) {
    await setActiveSeason(db, remaining[0].id);
  }
}

export async function listDestinations(db: SQLiteDatabase): Promise<Destination[]> {
  const rows = await db.getAllAsync<DestinationRow>('SELECT * FROM destinations ORDER BY name COLLATE NOCASE');
  return rows.map(mapDestination);
}

export async function getDestination(db: SQLiteDatabase, id: string): Promise<Destination | null> {
  const row = await db.getFirstAsync<DestinationRow>('SELECT * FROM destinations WHERE id = ?', id);
  return row ? mapDestination(row) : null;
}

export async function createDestination(
  db: SQLiteDatabase,
  input: { name: string; address: string | null; roundTripRate: number }
): Promise<Destination> {
  const id = createId();
  const now = nowIso();
  await db.runAsync(
    `INSERT INTO destinations (id, name, address, distance, distance_type, round_trip_rate, created_at, updated_at)
     VALUES (?, ?, ?, 0, 'round_trip', ?, ?, ?)`,
    id,
    input.name.trim(),
    input.address?.trim() || null,
    input.roundTripRate,
    now,
    now
  );
  const created = await getDestination(db, id);
  if (!created) throw new Error('Nie udało się dodać miejsca');
  return created;
}

export async function updateDestination(
  db: SQLiteDatabase,
  id: string,
  input: { name: string; address: string | null; roundTripRate: number }
): Promise<void> {
  await db.runAsync(
    `UPDATE destinations
     SET name = ?, address = ?, round_trip_rate = ?, updated_at = ?
     WHERE id = ?`,
    input.name.trim(),
    input.address?.trim() || null,
    input.roundTripRate,
    nowIso(),
    id
  );
}

export async function deleteDestination(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM destinations WHERE id = ?', id);
}

export async function listEventsBetween(
  db: SQLiteDatabase,
  start: string,
  end: string
): Promise<EventRecord[]> {
  const rows = await db.getAllAsync<EventRow>(
    `${EVENT_SELECT} WHERE e.date >= ? AND e.date <= ? ORDER BY e.date, e.start_time`,
    start,
    end
  );
  return rows.map(mapEvent);
}

export async function listEventsBySeason(db: SQLiteDatabase, seasonId: string): Promise<EventRecord[]> {
  const rows = await db.getAllAsync<EventRow>(
    `${EVENT_SELECT} WHERE e.season_id = ? ORDER BY e.date, e.start_time`,
    seasonId
  );
  return rows.map(mapEvent);
}

export async function listIncompleteEvents(db: SQLiteDatabase): Promise<EventRecord[]> {
  const rows = await db.getAllAsync<EventRow>(`${EVENT_SELECT} WHERE e.completed = 0`);
  return rows.map(mapEvent);
}

export async function getEvent(db: SQLiteDatabase, id: string): Promise<EventRecord | null> {
  const row = await db.getFirstAsync<EventRow>(`${EVENT_SELECT} WHERE e.id = ?`, id);
  return row ? mapEvent(row) : null;
}

export async function createEvent(db: SQLiteDatabase, draft: EventDraft): Promise<EventRecord> {
  const id = createId();
  const now = nowIso();
  await db.runAsync(
    `INSERT INTO events (
      id, season_id, date, start_time, end_time, type, destination_id,
      notes, completed, source, schedule_rule_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
    id,
    draft.seasonId,
    draft.date,
    draft.startTime,
    draft.endTime,
    draft.type,
    draft.destinationId,
    draft.notes,
    draft.source ?? 'manual',
    draft.scheduleRuleId ?? null,
    now,
    now
  );
  const created = await getEvent(db, id);
  if (!created) throw new Error('Nie udało się dodać wydarzenia');
  return created;
}

export async function updateEvent(
  db: SQLiteDatabase,
  id: string,
  draft: EventDraft
): Promise<EventRecord> {
  await db.runAsync(
    `UPDATE events
     SET season_id = ?, date = ?, start_time = ?, end_time = ?, type = ?, destination_id = ?, notes = ?, updated_at = ?
     WHERE id = ?`,
    draft.seasonId,
    draft.date,
    draft.startTime,
    draft.endTime,
    draft.type,
    draft.destinationId,
    draft.notes,
    nowIso(),
    id
  );
  const updated = await getEvent(db, id);
  if (!updated) throw new Error('Nie znaleziono wydarzenia');
  return updated;
}

export async function completeEvent(
  db: SQLiteDatabase,
  id: string,
  draft: CompletionDraft
): Promise<EventRecord> {
  const attended = draft.attended;
  const traveled = attended ? draft.traveled : null;
  const transport = attended && traveled ? draft.transport : null;
  const destinationId = attended && traveled ? draft.destinationId : draft.destinationId;
  const tripDirection = attended && traveled ? draft.tripDirection : null;
  const absenceNote = attended ? null : draft.absenceNote;

  await db.runAsync(
    `UPDATE events SET
      attended = ?,
      traveled = ?,
      transport = ?,
      arrived = NULL,
      destination_id = ?,
      trip_direction = ?,
      absence_note = ?,
      completed = 1,
      updated_at = ?
     WHERE id = ?`,
    attended ? 1 : 0,
    traveled === null ? null : traveled ? 1 : 0,
    transport,
    destinationId,
    tripDirection,
    absenceNote,
    nowIso(),
    id
  );
  const updated = await getEvent(db, id);
  if (!updated) throw new Error('Nie znaleziono wydarzenia');
  return updated;
}

export async function deleteEvent(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM events WHERE id = ?', id);
}

export async function setEventNotificationId(
  db: SQLiteDatabase,
  id: string,
  notificationId: string | null
): Promise<void> {
  await db.runAsync(
    'UPDATE events SET notification_id = ?, updated_at = ? WHERE id = ?',
    notificationId,
    nowIso(),
    id
  );
}

export async function getSettings(db: SQLiteDatabase): Promise<Settings> {
  const rows = await db.getAllAsync<SettingsRow>('SELECT key, value FROM settings');
  const map = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  return {
    reminderEnabled: (map.reminderEnabled ?? (DEFAULT_SETTINGS.reminderEnabled ? '1' : '0')) === '1',
    reminderTime: map.reminderTime ?? DEFAULT_SETTINGS.reminderTime,
    reminderOffsetMinutes: Number(map.reminderOffsetMinutes ?? DEFAULT_SETTINGS.reminderOffsetMinutes),
    kilometerRate: Number(map.kilometerRate ?? DEFAULT_SETTINGS.kilometerRate),
    defaultDurationMinutes: Number(
      map.defaultDurationMinutes ?? DEFAULT_SETTINGS.defaultDurationMinutes
    ),
  };
}

export async function getActiveGroupId(db: SQLiteDatabase): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', 'activeGroupId');
  return row?.value ? row.value : null;
}

export async function setActiveGroupId(db: SQLiteDatabase, id: string | null): Promise<void> {
  if (!id) {
    await db.runAsync('DELETE FROM settings WHERE key = ?', 'activeGroupId');
    return;
  }
  await db.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    'activeGroupId',
    id
  );
}

export async function updateSettings(
  db: SQLiteDatabase,
  patch: Partial<Settings>
): Promise<Settings> {
  const current = await getSettings(db);
  const next: Settings = { ...current, ...patch };
  const values: Record<string, string> = {
    reminderEnabled: next.reminderEnabled ? '1' : '0',
    reminderTime: next.reminderTime,
    reminderOffsetMinutes: String(next.reminderOffsetMinutes),
    kilometerRate: String(next.kilometerRate),
    defaultDurationMinutes: String(next.defaultDurationMinutes),
  };
  for (const [key, value] of Object.entries(values)) {
    await db.runAsync(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      key,
      value
    );
  }
  return next;
}

type ScheduleRow = {
  id: string;
  type: EventType;
  weekdays: string;
  start_time: string;
  end_time: string | null;
  destination_id: string | null;
  enabled: number;
  created_at: string;
  updated_at: string;
};

function parseWeekdays(value: string): number[] {
  return value
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item) && item >= 0 && item <= 6)
    .sort((a, b) => a - b);
}

function serializeWeekdays(weekdays: number[]): string {
  return [...new Set(weekdays)].sort((a, b) => a - b).join(',');
}

function mapSchedule(row: ScheduleRow): ScheduleRule {
  return {
    id: row.id,
    type: row.type,
    weekdays: parseWeekdays(row.weekdays),
    startTime: row.start_time,
    endTime: row.end_time,
    destinationId: row.destination_id,
    enabled: row.enabled === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listScheduleRules(db: SQLiteDatabase): Promise<ScheduleRule[]> {
  const rows = await db.getAllAsync<ScheduleRow>(
    'SELECT * FROM schedule_rules ORDER BY type, start_time'
  );
  return rows.map(mapSchedule);
}

export async function getScheduleRule(db: SQLiteDatabase, id: string): Promise<ScheduleRule | null> {
  const row = await db.getFirstAsync<ScheduleRow>('SELECT * FROM schedule_rules WHERE id = ?', id);
  return row ? mapSchedule(row) : null;
}

export async function createScheduleRule(
  db: SQLiteDatabase,
  input: {
    type: EventType;
    weekdays: number[];
    startTime: string;
    endTime: string | null;
    destinationId: string | null;
    enabled: boolean;
  }
): Promise<ScheduleRule> {
  const id = createId();
  const now = nowIso();
  await db.runAsync(
    `INSERT INTO schedule_rules (id, type, weekdays, start_time, end_time, destination_id, enabled, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    input.type,
    serializeWeekdays(input.weekdays),
    input.startTime,
    input.endTime,
    input.destinationId,
    input.enabled ? 1 : 0,
    now,
    now
  );
  const created = await getScheduleRule(db, id);
  if (!created) throw new Error('Nie udało się zapisać harmonogramu');
  return created;
}

export async function updateScheduleRule(
  db: SQLiteDatabase,
  id: string,
  input: {
    type: EventType;
    weekdays: number[];
    startTime: string;
    endTime: string | null;
    destinationId: string | null;
    enabled: boolean;
  }
): Promise<void> {
  await db.runAsync(
    `UPDATE schedule_rules
     SET type = ?, weekdays = ?, start_time = ?, end_time = ?, destination_id = ?, enabled = ?, updated_at = ?
     WHERE id = ?`,
    input.type,
    serializeWeekdays(input.weekdays),
    input.startTime,
    input.endTime,
    input.destinationId,
    input.enabled ? 1 : 0,
    nowIso(),
    id
  );
}

export async function deleteScheduleRule(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM schedule_rules WHERE id = ?', id);
}

export async function deleteFutureScheduledEvents(
  db: SQLiteDatabase,
  ruleId: string,
  fromDate: string
): Promise<void> {
  await db.runAsync(
    `DELETE FROM events
     WHERE schedule_rule_id = ? AND completed = 0 AND date >= ?`,
    ruleId,
    fromDate
  );
}
