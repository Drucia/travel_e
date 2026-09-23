import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DestinationRow } from '@/components/DestinationRow';
import { WeekdayPicker } from '@/components/WeekdayPicker';
import { DateField, TextField, TimeField } from '@/components/fields';
import { AppButton, ChoiceGroup, EmptyState, FormSwitch, Screen, SectionLabel } from '@/components/ui';
import { colors, space } from '@/constants/theme';
import { useApp, useDb } from '@/context/AppContext';
import { confirmAction } from '@/lib/confirm';
import { currentSeasonWindow, formatDayLong, toISODate } from '@/lib/dates';
import {
  createScheduleRule,
  deleteFutureScheduledEvents,
  deleteScheduleRule,
  getScheduleRule,
  listIncompleteEvents,
  updateScheduleRule,
} from '@/lib/db/queries';
import type { EventType } from '@/lib/db/types';
import { ensureNotificationSetup, rescheduleAllReminders } from '@/lib/notifications';
import { rebuildScheduleRuleEvents } from '@/lib/schedule';

export default function ScheduleFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const { destinations, refresh, settings, activeSeason } = useApp();
  const db = useDb();
  const editing = Boolean(id);

  const [type, setType] = useState<EventType>('training');
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [startTime, setStartTime] = useState('18:00');
  const [endTime, setEndTime] = useState<string | null>('19:30');
  const [destinationId, setDestinationId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [enabled, setEnabled] = useState(true);
  const seasonWindow = activeSeason ?? currentSeasonWindow();
  const [rangeStart, setRangeStart] = useState(seasonWindow.startDate);
  const [rangeEnd, setRangeEnd] = useState(seasonWindow.endDate);
  const [saving, setSaving] = useState(false);
  const knownDestinationIds = useRef<Set<string> | null>(null);
  const rangeSeeded = useRef(Boolean(activeSeason));

  useEffect(() => {
    if (knownDestinationIds.current === null) {
      knownDestinationIds.current = new Set(destinations.map((item) => item.id));
      return;
    }
    const added = destinations.find((item) => !knownDestinationIds.current?.has(item.id));
    knownDestinationIds.current = new Set(destinations.map((item) => item.id));
    if (added) setDestinationId(added.id);
  }, [destinations]);

  useEffect(() => {
    if (!activeSeason || rangeSeeded.current) return;
    rangeSeeded.current = true;
    setRangeStart(activeSeason.startDate);
    setRangeEnd(activeSeason.endDate);
  }, [activeSeason]);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      const rule = await getScheduleRule(db, id);
      if (!rule) return;
      setType(rule.type);
      setWeekdays(rule.weekdays);
      setStartTime(rule.startTime);
      setEndTime(rule.endTime);
      setDestinationId(rule.destinationId);
      setNotes(rule.notes ?? '');
      setEnabled(rule.enabled);
    })();
  }, [db, id]);

  async function save() {
    if (weekdays.length === 0) {
      Alert.alert('Wybierz dni', 'Zaznacz przynajmniej jeden dzień tygodnia.');
      return;
    }
    if (!activeSeason) {
      Alert.alert('Brak sezonu', 'Najpierw ustaw aktywny sezon.');
      return;
    }
    if (!rangeStart || !rangeEnd) {
      Alert.alert('Wybierz zakres', 'Podaj od kiedy i do kiedy dodać treningi w kalendarzu.');
      return;
    }
    if (rangeEnd < rangeStart) {
      Alert.alert('Niepoprawne daty', 'Data zakończenia musi być późniejsza niż data startu.');
      return;
    }
    setSaving(true);
    try {
      if (enabled) {
        await ensureNotificationSetup();
      }
      const payload = {
        type,
        weekdays,
        startTime,
        endTime,
        destinationId,
        notes: notes.trim() || null,
        enabled,
      };
      const ruleId = editing && id ? id : (await createScheduleRule(db, payload)).id;
      if (editing && id) {
        await updateScheduleRule(db, id, payload);
      }
      await rebuildScheduleRuleEvents(db, ruleId, { fromDate: rangeStart, toDate: rangeEnd });
      const incomplete = await listIncompleteEvents(db);
      await rescheduleAllReminders(settings, incomplete);
      await refresh();
      router.back();
    } catch (error) {
      Alert.alert('Nie udało się zapisać', error instanceof Error ? error.message : 'Spróbuj ponownie.');
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!id) return;
    const ok = await confirmAction(
      'Usunąć z harmonogramu?',
      'Przyszłe wydarzenia z tej reguły znikną z kalendarza.'
    );
    if (!ok) return;
    await deleteFutureScheduledEvents(db, id, toISODate(new Date()));
    await deleteScheduleRule(db, id);
    const incomplete = await listIncompleteEvents(db);
    await rescheduleAllReminders(settings, incomplete);
    await refresh();
    router.back();
  }

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <SectionLabel>Typ</SectionLabel>
          <ChoiceGroup
            options={[
              { label: '🏐 Trening', value: 'training' },
              { label: '🏆 Mecz', value: 'match' },
            ]}
            value={type}
            onChange={setType}
          />

          <SectionLabel>Dni tygodnia</SectionLabel>
          <WeekdayPicker value={weekdays} onChange={setWeekdays} />

          <TimeField label="Godzina rozpoczęcia" value={startTime} onChange={(value) => value && setStartTime(value)} />
          <TimeField label="Godzina zakończenia" value={endTime} onChange={setEndTime} optional />

          <SectionLabel>Miejsce (opcjonalnie)</SectionLabel>
          <View style={styles.list}>
            {destinations.length === 0 ? (
              <View style={styles.emptyPlace}>
                <EmptyState
                  title="Nie ma jeszcze miejsc"
                  hint="Dodaj halę albo boisko, żeby przypisać je do tych dni."
                />
                <AppButton
                  label="Dodaj miejsce"
                  onPress={() => router.push('/destinations/new')}
                />
              </View>
            ) : (
              <>
                {destinations.map((destination) => (
                  <DestinationRow
                    key={destination.id}
                    destination={destination}
                    selected={destination.id === destinationId}
                    onPress={() =>
                      setDestinationId((current) => (current === destination.id ? null : destination.id))
                    }
                  />
                ))}
                <AppButton
                  label="Dodaj miejsce"
                  variant="secondary"
                  onPress={() => router.push('/destinations/new')}
                />
              </>
            )}
          </View>

          <TextField
            label="Notatka do tych dni"
            value={notes}
            onChangeText={setNotes}
            placeholder="np. zbiórka 17:45, inny dojazd"
            multiline
          />
          <Text style={styles.help}>
            Ta sama notatka pojawi się przy każdym treningu albo meczu z tej reguły. W pojedynczym
            wydarzeniu możesz ją potem zmienić.
          </Text>

          <FormSwitch label="Włączone" value={enabled} onValueChange={setEnabled} />

          <DateField label="Dodaj w kalendarzu od" value={rangeStart} onChange={setRangeStart} />
          <DateField label="Dodaj w kalendarzu do" value={rangeEnd} onChange={setRangeEnd} />
          <Text style={styles.help}>
            Domyślnie cały aktywny sezon
            {activeSeason
              ? ` (${activeSeason.name}: ${formatDayLong(activeSeason.startDate)} – ${formatDayLong(activeSeason.endDate)})`
              : ''}
            . Możesz zwęzić zakres, np. tylko od dziś.
          </Text>

          <Text style={styles.help}>
            Powiadomienie przyjdzie zaraz po godzinie zakończenia, żeby uzupełnić dojazd.
          </Text>

          <AppButton label={saving ? 'Zapisywanie…' : 'Zapisz harmonogram'} onPress={() => void save()} disabled={saving} />
          {editing ? <AppButton label="Usuń" variant="danger" onPress={() => void confirmDelete()} /> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    padding: space.md,
    gap: space.md,
    paddingBottom: 40,
  },
  list: {
    gap: 8,
  },
  emptyPlace: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.md,
    gap: 8,
  },
  help: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
});
