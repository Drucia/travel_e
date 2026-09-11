import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';

import { clearPendingJoinCode, peekPendingJoinCode, useAuth } from '@/context/AuthContext';
import { cloudErrorMessage } from '@/lib/cloud/errors';
import {
  createGroup as createGroupRemote,
  joinGroupByCode,
  listDestinations,
  listIncompleteEvents,
  listMembers,
  listMyGroups,
  listScheduleRules,
  listSeasons,
} from '@/lib/cloud/queries';
import { getActiveGroupId, getSettings, setActiveGroupId } from '@/lib/db/queries';
import type { Destination, Group, GroupMember, ScheduleRule, Season, Settings } from '@/lib/db/types';
import { DEFAULT_SETTINGS } from '@/lib/db/types';
import { rescheduleAllReminders } from '@/lib/notifications';
import { generateScheduleEvents } from '@/lib/schedule';

type AppContextValue = {
  settings: Settings;
  seasons: Season[];
  destinations: Destination[];
  scheduleRules: ScheduleRule[];
  activeSeason: Season | null;
  groups: Group[];
  group: Group | null;
  members: GroupMember[];
  groupsLoaded: boolean;
  cloudError: string | null;
  userId: string | null;
  refresh: () => Promise<void>;
  selectGroup: (groupId: string) => Promise<void>;
  createGroup: (name: string) => Promise<Group>;
  joinGroup: (code: string) => Promise<Group>;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const { session, userId } = useAuth();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [scheduleRules, setScheduleRules] = useState<ScheduleRule[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [groupsLoaded, setGroupsLoaded] = useState(false);
  const [cloudError, setCloudError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!session || !userId) {
      setGroups([]);
      setGroup(null);
      setMembers([]);
      setSeasons([]);
      setDestinations([]);
      setScheduleRules([]);
      setCloudError(null);
      setGroupsLoaded(true);
      return;
    }

    try {
      setCloudError(null);
      const pendingCode = await peekPendingJoinCode();
      if (pendingCode) {
        try {
          const joinedId = await joinGroupByCode(pendingCode);
          await clearPendingJoinCode();
          await setActiveGroupId(db, joinedId);
        } catch (error) {
          const message = cloudErrorMessage(error);
          setCloudError(message);
          if (message.includes('Nie znaleziono grupy')) {
            await clearPendingJoinCode();
          }
        }
      }

      const myGroups = await listMyGroups();
      setGroups(myGroups);

      const storedId = await getActiveGroupId(db);
      const nextGroup = myGroups.find((item) => item.id === storedId) ?? myGroups[0] ?? null;
      if (nextGroup && nextGroup.id !== storedId) {
        await setActiveGroupId(db, nextGroup.id);
      }
      if (!nextGroup) {
        await setActiveGroupId(db, null);
      }
      setGroup(nextGroup);

      const nextSettings = await getSettings(db);
      setSettings(nextSettings);

      if (!nextGroup) {
        setSeasons([]);
        setDestinations([]);
        setScheduleRules([]);
        setMembers([]);
        setGroupsLoaded(true);
        return;
      }

      try {
        await generateScheduleEvents(nextGroup.id);
      } catch (error) {
        console.warn('Nie udało się wygenerować harmonogramu', error);
      }

      const [nextSeasons, nextDestinations, nextRules, nextMembers] = await Promise.all([
        listSeasons(nextGroup.id),
        listDestinations(nextGroup.id),
        listScheduleRules(nextGroup.id),
        listMembers(nextGroup.id),
      ]);
      setSeasons(nextSeasons);
      setDestinations(nextDestinations);
      setScheduleRules(nextRules);
      setMembers(nextMembers);

      if (Platform.OS !== 'web') {
        const incomplete = await listIncompleteEvents(nextGroup.id, userId);
        await rescheduleAllReminders(nextSettings, incomplete);
      }
    } catch (error) {
      console.warn('Nie udało się odświeżyć danych', error);
      setCloudError(cloudErrorMessage(error));
    } finally {
      setGroupsLoaded(true);
    }
  }, [db, session, userId]);

  useEffect(() => {
    setGroupsLoaded(false);
    void refresh();
  }, [refresh]);

  const selectGroup = useCallback(
    async (groupId: string) => {
      await setActiveGroupId(db, groupId);
      await refresh();
    },
    [db, refresh]
  );

  const createGroup = useCallback(
    async (name: string) => {
      if (!userId) throw new Error('Nie zalogowano');
      const created = await createGroupRemote(name, userId);
      await setActiveGroupId(db, created.id);
      await refresh();
      return created;
    },
    [db, refresh, userId]
  );

  const joinGroup = useCallback(
    async (code: string) => {
      const joinedId = await joinGroupByCode(code);
      await setActiveGroupId(db, joinedId);
      await refresh();
      const myGroups = await listMyGroups();
      const joined = myGroups.find((item) => item.id === joinedId);
      if (!joined) throw new Error('Nie znaleziono grupy o tym kodzie.');
      return joined;
    },
    [db, refresh]
  );

  const value = useMemo<AppContextValue>(
    () => ({
      settings,
      seasons,
      destinations,
      scheduleRules,
      activeSeason: seasons.find((season) => season.active) ?? seasons[0] ?? null,
      groups,
      group,
      members,
      groupsLoaded,
      cloudError,
      userId,
      refresh,
      selectGroup,
      createGroup,
      joinGroup,
    }),
    [
      settings,
      seasons,
      destinations,
      scheduleRules,
      groups,
      group,
      members,
      groupsLoaded,
      cloudError,
      userId,
      refresh,
      selectGroup,
      createGroup,
      joinGroup,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useApp musi być użyty wewnątrz AppProvider');
  }
  return ctx;
}

export function useDb() {
  return useSQLiteContext();
}

export function useGroupId(): string {
  const { group } = useApp();
  if (!group) {
    throw new Error('Wybierz grupę, aby korzystać z kalendarza.');
  }
  return group.id;
}
