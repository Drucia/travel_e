import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DateField, TextField } from '@/components/fields';
import { AppButton, Card, FormSwitch, Screen, StatLine } from '@/components/ui';
import { colors, radius, space } from '@/constants/theme';
import { useApp, useDb } from '@/context/AppContext';
import { confirmAction } from '@/lib/confirm';
import { deleteSeason, getSeason, listEventsBySeason, setActiveSeason, updateSeason } from '@/lib/db/queries';
import type { EventRecord, Season } from '@/lib/db/types';
import { formatAttendance, formatMoney, labeledCount } from '@/lib/format';
import { cancelEventReminder } from '@/lib/notifications';
import { generateScheduleEvents } from '@/lib/schedule';
import { computeStats } from '@/lib/stats';

export default function SeasonDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { destinations, refresh } = useApp();
  const db = useDb();
  const [season, setSeason] = useState<Season | null>(null);
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [includePast, setIncludePast] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const next = await getSeason(db, id);
    setSeason(next);
    setEvents(await listEventsBySeason(db, id));
    if (next) {
      setName(next.name);
      setStartDate(next.startDate);
      setEndDate(next.endDate);
    }
  }, [db, id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const stats = useMemo(() => computeStats(events, destinations), [events, destinations]);

  async function activate() {
    if (!id) return;
    await setActiveSeason(db, id);
    await generateScheduleEvents(db, { includePast });
    await refresh();
    await load();
  }

  async function saveDates() {
    if (!id || !season) return;
    if (!name.trim()) {
      Alert.alert('Nazwa jest wymagana');
      return;
    }
    if (endDate < startDate) {
      Alert.alert('Niepoprawne daty', 'Data zakończenia musi być późniejsza niż data startu.');
      return;
    }
    setSaving(true);
    try {
      await updateSeason(db, id, { name, startDate, endDate });
      const next = await getSeason(db, id);
      if (next?.active) {
        await generateScheduleEvents(db, { includePast });
      }
      await refresh();
      await load();
    } catch (error) {
      Alert.alert('Nie udało się zapisać', error instanceof Error ? error.message : 'Spróbuj ponownie.');
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!id) return;
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
      await deleteSeason(db, id);
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
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.form}>
              <TextField label="Nazwa" value={name} onChangeText={setName} placeholder="Sezon 2026/2027" />
              <DateField label="Data rozpoczęcia" value={startDate} onChange={setStartDate} />
              <DateField label="Data zakończenia" value={endDate} onChange={setEndDate} />
              <FormSwitch
                label="Dopisz treningi z harmonogramu wstecz"
                value={includePast}
                onValueChange={setIncludePast}
                hint="Gdy zapiszesz okres sezonu, stałe dni z harmonogramu pojawią się też przed dniem dzisiejszym."
              />
              <AppButton
                label={saving ? 'Zapisywanie…' : 'Zapisz okres sezonu'}
                onPress={() => void saveDates()}
                disabled={saving}
              />
            </View>
          </KeyboardAvoidingView>
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
                    {labeledCount(place.trips, 'wyjazd', 'wyjazdy', 'wyjazdów')}
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
  form: {
    gap: space.md,
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
