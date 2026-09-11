import { CloudError, cloudErrorMessage } from '@/lib/cloud/errors';
import { randomJoinCode, sanitizeJoinCode } from '@/lib/cloud/join';
import { currentSeasonWindow } from '@/lib/dates';
import type {
  CloudEvent,
  CompletionDraft,
  Destination,
  EventDraft,
  EventRecord,
  EventResponse,
  EventType,
  Group,
  GroupMember,
  GroupRole,
  ScheduleRule,
  Season,
  Transport,
  TripDirection,
} from '@/lib/db/types';
import { nowIso } from '@/lib/id';
import { getSupabase } from '@/lib/supabase/client';

type GroupRow = {
  id: string;
  name: string;
  join_code: string;
  created_by: string;
  created_at: string;
};

type MemberRow = {
  group_id: string;
  user_id: string;
  role: GroupRole;
  created_at: string;
};

type ProfileRow = {
  id: string;
  email: string | null;
  display_name: string | null;
};

type SeasonRow = {
  id: string;
  group_id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type DestinationRow = {
  id: string;
  group_id: string;
  name: string;
  address: string | null;
  distance: number | string | null;
  distance_type: 'one_way' | 'round_trip';
  round_trip_rate: number | string | null;
  created_at: string;
  updated_at: string;
};

type EventRow = {
  id: string;
  group_id: string;
  season_id: string;
  date: string;
  start_time: string;
  end_time: string | null;
  type: EventType;
  destination_id: string | null;
  notes: string | null;
  source: 'manual' | 'schedule' | null;
  schedule_rule_id: string | null;
  created_at: string;
  updated_at: string;
  destinations?: { name: string } | { name: string }[] | null;
};

type ResponseRow = {
  user_id: string;
  event_id: string;
  attended: boolean | null;
  traveled: boolean | null;
  transport: Transport | null;
  trip_direction: TripDirection | null;
  destination_id: string | null;
  absence_note: string | null;
  completed: boolean;
  created_at: string;
  updated_at: string;
};

type ScheduleRow = {
  id: string;
  group_id: string;
  type: EventType;
  weekdays: string;
  start_time: string;
  end_time: string | null;
  destination_id: string | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
};

function fail(error: unknown): never {
  throw error instanceof CloudError ? error : new CloudError(cloudErrorMessage(error));
}

function unwrap<T>(data: T | null, error: { message: string } | null, fallbackMessage: string): T {
  if (error) fail(error);
  if (data === null) fail(new CloudError(fallbackMessage));
  return data;
}

function num(value: number | string | null | undefined): number {
  const n = typeof value === 'number' ? value : Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function destinationNameFromJoin(value: EventRow['destinations']): string | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0]?.name ?? null;
  return value.name ?? null;
}

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

function mapSeason(row: SeasonRow): Season {
  return {
    id: row.id,
    name: row.name,
    startDate: row.start_date,
    endDate: row.end_date,
    active: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapDestination(row: DestinationRow): Destination {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    distance: num(row.distance),
    distanceType: row.distance_type,
    roundTripRate: num(row.round_trip_rate),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCloudEvent(row: EventRow): CloudEvent {
  return {
    id: row.id,
    groupId: row.group_id,
    seasonId: row.season_id,
    date: row.date,
    startTime: row.start_time,
    endTime: row.end_time,
    type: row.type,
    destinationId: row.destination_id,
    destinationName: destinationNameFromJoin(row.destinations),
    notes: row.notes,
    source: row.source === 'schedule' ? 'schedule' : 'manual',
    scheduleRuleId: row.schedule_rule_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapResponse(row: ResponseRow): EventResponse {
  return {
    userId: row.user_id,
    eventId: row.event_id,
    attended: row.attended,
    traveled: row.traveled,
    transport: row.transport,
    tripDirection: row.trip_direction,
    destinationId: row.destination_id,
    absenceNote: row.absence_note,
    completed: row.completed,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSchedule(row: ScheduleRow): ScheduleRule {
  return {
    id: row.id,
    type: row.type,
    weekdays: parseWeekdays(row.weekdays),
    startTime: row.start_time,
    endTime: row.end_time,
    destinationId: row.destination_id,
    enabled: row.enabled,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toEventRecord(
  event: CloudEvent,
  response: EventResponse | null,
  destinations: Destination[] = []
): EventRecord {
  const destId = response?.destinationId ?? event.destinationId;
  const dest = destId ? destinations.find((item) => item.id === destId) : undefined;
  return {
    id: event.id,
    seasonId: event.seasonId,
    date: event.date,
    startTime: event.startTime,
    endTime: event.endTime,
    type: event.type,
    destinationId: destId,
    attended: response?.attended ?? null,
    traveled: response?.traveled ?? null,
    transport: response?.transport ?? null,
    arrived: null,
    tripDirection: response?.tripDirection ?? null,
    notes: event.notes,
    absenceNote: response?.absenceNote ?? null,
    completed: response?.completed ?? false,
    notificationId: null,
    createdAt: event.createdAt,
    updatedAt: response?.updatedAt ?? event.updatedAt,
    destinationName: dest?.name ?? event.destinationName,
  };
}

async function mergeWithUser(
  events: CloudEvent[],
  userId: string,
  destinations: Destination[]
): Promise<EventRecord[]> {
  const responses = await listResponsesForUser(
    events.map((event) => event.id),
    userId
  );
  const map = new Map(responses.map((item) => [item.eventId, item]));
  return events.map((event) => toEventRecord(event, map.get(event.id) ?? null, destinations));
}

export async function listMyGroups(): Promise<Group[]> {
  const supabase = getSupabase();
  const { data: memberships, error } = await supabase
    .from('group_members')
    .select('group_id, role, created_at')
    .order('created_at', { ascending: true });
  if (error) fail(error);
  const rows = (memberships ?? []) as MemberRow[];
  if (rows.length === 0) return [];

  const { data: groups, error: groupsError } = await supabase
    .from('groups')
    .select('id, name, join_code, created_by, created_at')
    .in(
      'id',
      rows.map((row) => row.group_id)
    );
  if (groupsError) fail(groupsError);
  const groupMap = new Map(((groups ?? []) as GroupRow[]).map((row) => [row.id, row]));

  return rows
    .map((row) => {
      const group = groupMap.get(row.group_id);
      if (!group) return null;
      return {
        id: group.id,
        name: group.name,
        joinCode: group.join_code,
        createdBy: group.created_by,
        createdAt: group.created_at,
        role: row.role,
      } satisfies Group;
    })
    .filter((item): item is Group => item !== null);
}

export async function createGroup(name: string, createdBy: string): Promise<Group> {
  const supabase = getSupabase();
  const trimmed = name.trim();
  if (!trimmed) fail(new CloudError('Podaj nazwę grupy.'));

  let lastError: unknown = null;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const { data, error } = await supabase
      .from('groups')
      .insert({
        name: trimmed,
        join_code: randomJoinCode(),
        created_by: createdBy,
      })
      .select('id, name, join_code, created_by, created_at')
      .single();
    if (!error && data) {
      const group = data as GroupRow;
      const season = currentSeasonWindow();
      await createSeason(group.id, {
        name: season.name,
        startDate: season.startDate,
        endDate: season.endDate,
        active: true,
      });
      return {
        id: group.id,
        name: group.name,
        joinCode: group.join_code,
        createdBy: group.created_by,
        createdAt: group.created_at,
        role: 'owner',
      };
    }
    lastError = error;
    const code = error && 'code' in error ? String((error as { code?: string }).code) : '';
    if (code !== '23505') fail(error);
  }
  fail(lastError);
}

export async function joinGroupByCode(code: string): Promise<string> {
  const supabase = getSupabase();
  const cleaned = sanitizeJoinCode(code);
  if (cleaned.length < 4) fail(new CloudError('Podaj kod grupy.'));
  const { data, error } = await supabase.rpc('join_group', { p_code: cleaned });
  if (error) fail(error);
  if (!data) fail(new CloudError('Nie znaleziono grupy o tym kodzie.'));
  return String(data);
}

export async function deleteGroup(groupId: string): Promise<void> {
  const { error } = await getSupabase().from('groups').delete().eq('id', groupId);
  if (error) fail(error);
}

export async function leaveGroup(groupId: string, userId: string): Promise<void> {
  const { error } = await getSupabase()
    .from('group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', userId);
  if (error) fail(error);
}

export async function removeMember(groupId: string, userId: string): Promise<void> {
  const { error } = await getSupabase()
    .from('group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', userId);
  if (error) fail(error);
}

export async function listMembers(groupId: string): Promise<GroupMember[]> {
  const supabase = getSupabase();
  const { data: members, error } = await supabase
    .from('group_members')
    .select('user_id, role, created_at')
    .eq('group_id', groupId)
    .order('created_at', { ascending: true });
  if (error) fail(error);
  const rows = (members ?? []) as Pick<MemberRow, 'user_id' | 'role' | 'created_at'>[];
  if (rows.length === 0) return [];

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, email, display_name')
    .in(
      'id',
      rows.map((row) => row.user_id)
    );
  if (profilesError) fail(profilesError);
  const profileMap = new Map(((profiles ?? []) as ProfileRow[]).map((row) => [row.id, row]));

  return rows.map((row) => {
    const profile = profileMap.get(row.user_id);
    const displayName =
      profile?.display_name?.trim() ||
      profile?.email?.split('@')[0] ||
      'Członkini';
    return {
      userId: row.user_id,
      role: row.role,
      email: profile?.email ?? null,
      displayName,
      createdAt: row.created_at,
    };
  });
}

export async function listSeasons(groupId: string): Promise<Season[]> {
  const { data, error } = await getSupabase()
    .from('seasons')
    .select('*')
    .eq('group_id', groupId)
    .order('is_active', { ascending: false })
    .order('start_date', { ascending: false });
  if (error) fail(error);
  return ((data ?? []) as SeasonRow[]).map(mapSeason);
}

export async function getSeason(id: string): Promise<Season | null> {
  const { data, error } = await getSupabase().from('seasons').select('*').eq('id', id).maybeSingle();
  if (error) fail(error);
  return data ? mapSeason(data as SeasonRow) : null;
}

export async function getActiveSeason(groupId: string): Promise<Season | null> {
  const { data, error } = await getSupabase()
    .from('seasons')
    .select('*')
    .eq('group_id', groupId)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();
  if (error) fail(error);
  return data ? mapSeason(data as SeasonRow) : null;
}

export async function createSeason(
  groupId: string,
  input: { name: string; startDate: string; endDate: string; active: boolean }
): Promise<Season> {
  const supabase = getSupabase();
  const now = nowIso();
  if (input.active) {
    const { error: clearError } = await supabase
      .from('seasons')
      .update({ is_active: false, updated_at: now })
      .eq('group_id', groupId)
      .eq('is_active', true);
    if (clearError) fail(clearError);
  }
  const { data, error } = await supabase
    .from('seasons')
    .insert({
      group_id: groupId,
      name: input.name.trim(),
      start_date: input.startDate,
      end_date: input.endDate,
      is_active: input.active,
      created_at: now,
      updated_at: now,
    })
    .select('*')
    .single();
  const row = unwrap(data as SeasonRow | null, error, 'Nie udało się utworzyć sezonu');
  return mapSeason(row);
}

export async function setActiveSeason(groupId: string, id: string): Promise<void> {
  const supabase = getSupabase();
  const now = nowIso();
  const { error: clearError } = await supabase
    .from('seasons')
    .update({ is_active: false, updated_at: now })
    .eq('group_id', groupId);
  if (clearError) fail(clearError);
  const { error } = await supabase
    .from('seasons')
    .update({ is_active: true, updated_at: now })
    .eq('id', id)
    .eq('group_id', groupId);
  if (error) fail(error);
}

export async function deleteSeason(groupId: string, id: string): Promise<void> {
  const { error } = await getSupabase().from('seasons').delete().eq('id', id);
  if (error) fail(error);
  const remaining = await listSeasons(groupId);
  if (remaining.length > 0 && !remaining.some((season) => season.active)) {
    await setActiveSeason(groupId, remaining[0].id);
  }
}

export async function listDestinations(groupId: string): Promise<Destination[]> {
  const { data, error } = await getSupabase()
    .from('destinations')
    .select('*')
    .eq('group_id', groupId)
    .order('name', { ascending: true });
  if (error) fail(error);
  return ((data ?? []) as DestinationRow[]).map(mapDestination);
}

export async function getDestination(id: string): Promise<Destination | null> {
  const { data, error } = await getSupabase().from('destinations').select('*').eq('id', id).maybeSingle();
  if (error) fail(error);
  return data ? mapDestination(data as DestinationRow) : null;
}

export async function createDestination(
  groupId: string,
  input: { name: string; address: string | null; roundTripRate: number }
): Promise<Destination> {
  const now = nowIso();
  const { data, error } = await getSupabase()
    .from('destinations')
    .insert({
      group_id: groupId,
      name: input.name.trim(),
      address: input.address?.trim() || null,
      distance: 0,
      distance_type: 'round_trip',
      round_trip_rate: input.roundTripRate,
      created_at: now,
      updated_at: now,
    })
    .select('*')
    .single();
  const row = unwrap(data as DestinationRow | null, error, 'Nie udało się dodać miejsca');
  return mapDestination(row);
}

export async function updateDestination(
  id: string,
  input: { name: string; address: string | null; roundTripRate: number }
): Promise<void> {
  const { error } = await getSupabase()
    .from('destinations')
    .update({
      name: input.name.trim(),
      address: input.address?.trim() || null,
      round_trip_rate: input.roundTripRate,
      updated_at: nowIso(),
    })
    .eq('id', id);
  if (error) fail(error);
}

export async function deleteDestination(id: string): Promise<void> {
  const { error } = await getSupabase().from('destinations').delete().eq('id', id);
  if (error) fail(error);
}

const EVENT_SELECT = '*, destinations ( name )';

export async function listCloudEvents(groupId: string, start: string, end: string): Promise<CloudEvent[]> {
  const { data, error } = await getSupabase()
    .from('events')
    .select(EVENT_SELECT)
    .eq('group_id', groupId)
    .gte('date', start)
    .lte('date', end)
    .order('date', { ascending: true })
    .order('start_time', { ascending: true });
  if (error) fail(error);
  return ((data ?? []) as EventRow[]).map(mapCloudEvent);
}

async function listResponsesForUser(eventIds: string[], userId: string): Promise<EventResponse[]> {
  if (eventIds.length === 0) return [];
  const { data, error } = await getSupabase()
    .from('event_responses')
    .select('*')
    .eq('user_id', userId)
    .in('event_id', eventIds);
  if (error) fail(error);
  return ((data ?? []) as ResponseRow[]).map(mapResponse);
}

export async function listResponsesForEvents(eventIds: string[]): Promise<EventResponse[]> {
  if (eventIds.length === 0) return [];
  const { data, error } = await getSupabase().from('event_responses').select('*').in('event_id', eventIds);
  if (error) fail(error);
  return ((data ?? []) as ResponseRow[]).map(mapResponse);
}

export async function listEventsBetween(
  groupId: string,
  userId: string,
  start: string,
  end: string
): Promise<EventRecord[]> {
  const [events, destinations] = await Promise.all([
    listCloudEvents(groupId, start, end),
    listDestinations(groupId),
  ]);
  return mergeWithUser(events, userId, destinations);
}

export async function listEventsBySeason(
  groupId: string,
  userId: string,
  seasonId: string
): Promise<EventRecord[]> {
  const { data, error } = await getSupabase()
    .from('events')
    .select(EVENT_SELECT)
    .eq('group_id', groupId)
    .eq('season_id', seasonId)
    .order('date', { ascending: true })
    .order('start_time', { ascending: true });
  if (error) fail(error);
  const events = ((data ?? []) as EventRow[]).map(mapCloudEvent);
  const destinations = await listDestinations(groupId);
  return mergeWithUser(events, userId, destinations);
}

export async function listIncompleteEvents(groupId: string, userId: string): Promise<EventRecord[]> {
  const { data, error } = await getSupabase()
    .from('events')
    .select(EVENT_SELECT)
    .eq('group_id', groupId)
    .order('date', { ascending: true });
  if (error) fail(error);
  const events = ((data ?? []) as EventRow[]).map(mapCloudEvent);
  const destinations = await listDestinations(groupId);
  const merged = await mergeWithUser(events, userId, destinations);
  return merged.filter((event) => !event.completed);
}

export async function getEvent(id: string, userId: string, destinations: Destination[] = []): Promise<EventRecord | null> {
  const { data, error } = await getSupabase().from('events').select(EVENT_SELECT).eq('id', id).maybeSingle();
  if (error) fail(error);
  if (!data) return null;
  const event = mapCloudEvent(data as EventRow);
  const responses = await listResponsesForUser([id], userId);
  return toEventRecord(event, responses[0] ?? null, destinations);
}

export async function createEvent(groupId: string, draft: EventDraft): Promise<CloudEvent> {
  const now = nowIso();
  const { data, error } = await getSupabase()
    .from('events')
    .insert({
      group_id: groupId,
      season_id: draft.seasonId,
      date: draft.date,
      start_time: draft.startTime,
      end_time: draft.endTime,
      type: draft.type,
      destination_id: draft.destinationId,
      notes: draft.notes,
      source: draft.source ?? 'manual',
      schedule_rule_id: draft.scheduleRuleId ?? null,
      created_at: now,
      updated_at: now,
    })
    .select(EVENT_SELECT)
    .single();
  const row = unwrap(data as EventRow | null, error, 'Nie udało się dodać wydarzenia');
  return mapCloudEvent(row);
}

export async function createEventForUser(
  groupId: string,
  _userId: string,
  draft: EventDraft,
  destinations: Destination[] = []
): Promise<EventRecord> {
  const event = await createEvent(groupId, draft);
  return toEventRecord(event, null, destinations);
}

export async function updateEvent(id: string, draft: EventDraft): Promise<CloudEvent> {
  const { data, error } = await getSupabase()
    .from('events')
    .update({
      season_id: draft.seasonId,
      date: draft.date,
      start_time: draft.startTime,
      end_time: draft.endTime,
      type: draft.type,
      destination_id: draft.destinationId,
      notes: draft.notes,
      updated_at: nowIso(),
    })
    .eq('id', id)
    .select(EVENT_SELECT)
    .single();
  const row = unwrap(data as EventRow | null, error, 'Nie znaleziono wydarzenia');
  return mapCloudEvent(row);
}

export async function updateEventForUser(
  id: string,
  userId: string,
  draft: EventDraft,
  destinations: Destination[] = []
): Promise<EventRecord> {
  const event = await updateEvent(id, draft);
  const responses = await listResponsesForUser([id], userId);
  return toEventRecord(event, responses[0] ?? null, destinations);
}

export async function completeEvent(
  userId: string,
  eventId: string,
  draft: CompletionDraft,
  destinations: Destination[] = []
): Promise<EventRecord> {
  const attended = draft.attended;
  const traveled = attended ? draft.traveled : null;
  const transport = attended && traveled ? draft.transport : null;
  const destinationId = attended && traveled ? draft.destinationId : draft.destinationId;
  const tripDirection = attended && traveled ? draft.tripDirection : null;
  const absenceNote = attended ? null : draft.absenceNote;
  const now = nowIso();

  const { error } = await getSupabase().from('event_responses').upsert(
    {
      user_id: userId,
      event_id: eventId,
      attended,
      traveled,
      transport,
      trip_direction: tripDirection,
      destination_id: destinationId,
      absence_note: absenceNote,
      completed: true,
      updated_at: now,
    },
    { onConflict: 'user_id,event_id' }
  );
  if (error) fail(error);
  const event = await getEvent(eventId, userId, destinations);
  if (!event) fail(new CloudError('Nie znaleziono wydarzenia'));
  return event;
}

export async function deleteEvent(id: string): Promise<void> {
  const { error } = await getSupabase().from('events').delete().eq('id', id);
  if (error) fail(error);
}

export async function listScheduleRules(groupId: string): Promise<ScheduleRule[]> {
  const { data, error } = await getSupabase()
    .from('schedule_rules')
    .select('*')
    .eq('group_id', groupId)
    .order('type', { ascending: true })
    .order('start_time', { ascending: true });
  if (error) fail(error);
  return ((data ?? []) as ScheduleRow[]).map(mapSchedule);
}

export async function getScheduleRule(id: string): Promise<ScheduleRule | null> {
  const { data, error } = await getSupabase().from('schedule_rules').select('*').eq('id', id).maybeSingle();
  if (error) fail(error);
  return data ? mapSchedule(data as ScheduleRow) : null;
}

export async function createScheduleRule(
  groupId: string,
  input: {
    type: EventType;
    weekdays: number[];
    startTime: string;
    endTime: string | null;
    destinationId: string | null;
    enabled: boolean;
  }
): Promise<ScheduleRule> {
  const now = nowIso();
  const { data, error } = await getSupabase()
    .from('schedule_rules')
    .insert({
      group_id: groupId,
      type: input.type,
      weekdays: serializeWeekdays(input.weekdays),
      start_time: input.startTime,
      end_time: input.endTime,
      destination_id: input.destinationId,
      enabled: input.enabled,
      created_at: now,
      updated_at: now,
    })
    .select('*')
    .single();
  const row = unwrap(data as ScheduleRow | null, error, 'Nie udało się zapisać harmonogramu');
  return mapSchedule(row);
}

export async function updateScheduleRule(
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
  const { error } = await getSupabase()
    .from('schedule_rules')
    .update({
      type: input.type,
      weekdays: serializeWeekdays(input.weekdays),
      start_time: input.startTime,
      end_time: input.endTime,
      destination_id: input.destinationId,
      enabled: input.enabled,
      updated_at: nowIso(),
    })
    .eq('id', id);
  if (error) fail(error);
}

export async function deleteScheduleRule(id: string): Promise<void> {
  const { error } = await getSupabase().from('schedule_rules').delete().eq('id', id);
  if (error) fail(error);
}

export async function deleteFutureScheduledEvents(ruleId: string, fromDate: string): Promise<void> {
  const { error } = await getSupabase()
    .from('events')
    .delete()
    .eq('schedule_rule_id', ruleId)
    .gte('date', fromDate);
  if (error) fail(error);
}

export async function insertScheduledEvents(
  groupId: string,
  rows: EventDraft[]
): Promise<void> {
  if (rows.length === 0) return;
  const now = nowIso();
  const { error } = await getSupabase().from('events').insert(
    rows.map((draft) => ({
      group_id: groupId,
      season_id: draft.seasonId,
      date: draft.date,
      start_time: draft.startTime,
      end_time: draft.endTime,
      type: draft.type,
      destination_id: draft.destinationId,
      notes: draft.notes,
      source: draft.source ?? 'schedule',
      schedule_rule_id: draft.scheduleRuleId ?? null,
      created_at: now,
      updated_at: now,
    }))
  );
  if (error) {
    const code = 'code' in error ? String((error as { code?: string }).code) : '';
    if (code === '23505') return;
    fail(error);
  }
}
