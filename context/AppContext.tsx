import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';

import { getSettings, listDestinations, listScheduleRules, listSeasons } from '@/lib/db/queries';
import type { Destination, ScheduleRule, Season, Settings } from '@/lib/db/types';
import { DEFAULT_SETTINGS } from '@/lib/db/types';
import { rescheduleAllReminders } from '@/lib/notifications';
import { generateScheduleEvents } from '@/lib/schedule';

type AppContextValue = {
  settings: Settings;
  seasons: Season[];
  destinations: Destination[];
  scheduleRules: ScheduleRule[];
  activeSeason: Season | null;
  refresh: () => Promise<void>;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [scheduleRules, setScheduleRules] = useState<ScheduleRule[]>([]);

  const refresh = useCallback(async () => {
    try {
      await generateScheduleEvents(db);
      const [nextSettings, nextSeasons, nextDestinations, nextRules] = await Promise.all([
        getSettings(db),
        listSeasons(db),
        listDestinations(db),
        listScheduleRules(db),
      ]);
      setSettings(nextSettings);
      setSeasons(nextSeasons);
      setDestinations(nextDestinations);
      setScheduleRules(nextRules);
    } catch (error) {
      console.warn('Nie udało się odświeżyć danych', error);
    }
  }, [db]);

  useEffect(() => {
    void (async () => {
      await refresh();
      if (Platform.OS !== 'web') {
        await rescheduleAllReminders(db);
      }
    })();
  }, [db, refresh]);

  const value = useMemo<AppContextValue>(
    () => ({
      settings,
      seasons,
      destinations,
      scheduleRules,
      activeSeason: seasons.find((season) => season.active) ?? seasons[0] ?? null,
      refresh,
    }),
    [settings, seasons, destinations, scheduleRules, refresh]
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
