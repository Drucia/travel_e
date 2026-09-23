import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import { getSettings, listDestinations, listIncompleteEvents, listScheduleRules, listSeasons } from '@/lib/db/queries';
import { createBackup } from '@/lib/backup';
import { saveDeviceCopy } from '@/lib/backupStorage';
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
  loaded: boolean;
  refresh: () => Promise<void>;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [scheduleRules, setScheduleRules] = useState<ScheduleRule[]>([]);
  const [loaded, setLoaded] = useState(false);

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

      try {
        await saveDeviceCopy(await createBackup(db));
      } catch (error) {
        console.warn('Nie udało się zapisać kopii na urządzeniu', error);
      }

      const incomplete = await listIncompleteEvents(db);
      await rescheduleAllReminders(nextSettings, incomplete);
    } catch (error) {
      console.warn('Nie udało się odświeżyć danych', error);
    } finally {
      setLoaded(true);
    }
  }, [db]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<AppContextValue>(
    () => ({
      settings,
      seasons,
      destinations,
      scheduleRules,
      activeSeason: seasons.find((season) => season.active) ?? seasons[0] ?? null,
      loaded,
      refresh,
    }),
    [settings, seasons, destinations, scheduleRules, loaded, refresh]
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
