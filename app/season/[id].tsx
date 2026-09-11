import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppButton, Card, Screen, StatLine } from '@/components/ui';
import { colors, radius, space } from '@/constants/theme';
import { useApp } from '@/context/AppContext';
import { confirmAction } from '@/lib/confirm';
import { deleteSeason, getSeason, listEventsBySeason, setActiveSeason } from '@/lib/cloud/queries';
import { formatDayLong } from '@/lib/dates';
import type { EventRecord, Season } from '@/lib/db/types';
import { formatAttendance, formatMoney, labeledCount } from '@/lib/format';
import { cancelEventReminder } from '@/lib/notifications';
import { computeStats } from '@/lib/stats';

export default function SeasonDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { destinations, refresh, group, userId } = useApp();
  const [season, setSeason] = useState<Season | null>(null);
  const [events, setEvents] = useState<EventRecord[]>([]);

  const load = useCallback(async () => {
    if (!id || !group || !userId) return;
    setSeason(await getSeason(id));
    setEvents(await listEventsBySeason(group.id, userId, id));
  }, [group, id, userId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const stats = useMemo(() => computeStats(events, destinations), [events, destinations]);

  async function activate() {
    if (!id || !group) return;
    await setActiveSeason(group.id, id);
    await refresh();
    await load();
  }

  async function confirmDelete() {
    if (!id || !group) return;
    const message =
      events.length > 0
        ? `Zostaną też usunięte ${labeledCount(events.length, 'wydarzenie', 'wydarzenia', 'wydarzeń')} z tego sezonu. Tego nie cofniesz.`
        : 'Tej operacji nie można cofnąć.';
    const ok = await confirmAction('Usunąć sezon?', message);
    if (!ok) return;

    try {
      for (const event of events) {
        await cancelEventReminder(event.id);
      }
      await deleteSeason(group.id, id);
      await refresh();
      router.replace('/seasons');
    } catch (error) {
      Alert.alert('Nie można usunąć', error instanceof Error ? error.message : 'Spróbuj ponownie.');
    }
  }

  if (!season) {
    return (
      <Screen>
        <Text style={styles.missing}>Nie znaleziono sezonu.</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Card>
          <Text style={styles.name}>{season.name}</Text>
          <Text style={styles.meta}>
            {formatDayLong(season.startDate)} – {formatDayLong(season.endDate)}
          </Text>
          {season.active ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Aktywny</Text>
            </View>
          ) : (
            <Pressable onPress={() => void activate()} style={styles.activate}>
              <Text style={styles.activateText}>Ustaw jako aktywny</Text>
            </Pressable>
          )}
        </Card>

        <Card>
          <StatLine
            label="Obecność · treningi"
            value={formatAttendance(stats.attendedTrainings, stats.trainings)}
          />
          <StatLine
            label="Obecność · mecze"
            value={formatAttendance(stats.attendedMatches, stats.matches)}
          />
          <StatLine label="Wyjazdy" value={String(stats.trips)} />
          <StatLine label="Wyjazdy samochodem" value={String(stats.carTrips)} />
          <StatLine label="Łączna kwota" value={formatMoney(stats.amount)} accent />
        </Card>

        <Card>
          <Text style={styles.section}>Według miejsc</Text>
          {stats.byPlace.length === 0 ? (
            <Text style={styles.empty}>Brak wyjazdów w tym sezonie.</Text>
          ) : (
            stats.byPlace.map((place) => (
              <View key={place.destinationId} style={styles.placeRow}>
                <View>
                  <Text style={styles.placeName}>{place.name}</Text>
                  <Text style={styles.placeMeta}>
                    {labeledCount(place.trips, 'wyjazd', 'wyjazdy', 'wyjazdów')} · samochód: {place.carTrips}
                  </Text>
                </View>
                <Text style={styles.placeKm}>{formatMoney(place.amount)}</Text>
              </View>
            ))
          )}
        </Card>

        <AppButton label="Usuń sezon" variant="danger" onPress={() => void confirmDelete()} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: space.md,
    gap: space.md,
    paddingBottom: 40,
  },
  name: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '800',
  },
  meta: {
    marginTop: 6,
    color: colors.muted,
    fontSize: 14,
  },
  badge: {
    alignSelf: 'flex-start',
    marginTop: 12,
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeText: {
    fontWeight: '800',
    fontSize: 12,
    color: colors.text,
  },
  activate: {
    alignSelf: 'flex-start',
    marginTop: 12,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  activateText: {
    fontWeight: '700',
    color: colors.text,
  },
  section: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  empty: {
    color: colors.muted,
  },
  placeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  placeName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  placeMeta: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 2,
  },
  placeKm: {
    color: colors.text,
    fontWeight: '700',
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
  missing: {
    padding: space.lg,
    color: colors.muted,
  },
});
