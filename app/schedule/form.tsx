import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { DestinationRow } from '@/components/DestinationRow';
import { WeekdayPicker } from '@/components/WeekdayPicker';
import { TimeField } from '@/components/fields';
import { AppButton, ChoiceGroup, Screen, SectionLabel } from '@/components/ui';
import { colors, space } from '@/constants/theme';
import { useApp, useDb } from '@/context/AppContext';
import { confirmAction } from '@/lib/confirm';
import { toISODate } from '@/lib/dates';
import {
  createScheduleRule,
  deleteFutureScheduledEvents,
  deleteScheduleRule,
  getScheduleRule,
  updateScheduleRule,
} from '@/lib/db/queries';
import type { EventType } from '@/lib/db/types';
import { ensureNotificationSetup, rescheduleAllReminders } from '@/lib/notifications';
import { rebuildScheduleRuleEvents } from '@/lib/schedule';

export default function ScheduleFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const db = useDb();
  const router = useRouter();
  const { destinations, refresh } = useApp();
  const editing = Boolean(id);

  const [type, setType] = useState<EventType>('training');
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [startTime, setStartTime] = useState('18:00');
  const [endTime, setEndTime] = useState<string | null>('19:30');
  const [destinationId, setDestinationId] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);

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
      setEnabled(rule.enabled);
    })();
  }, [db, id]);

  async function save() {
    if (weekdays.length === 0) {
      Alert.alert('Wybierz dni', 'Zaznacz przynajmniej jeden dzień tygodnia.');
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
        enabled,
      };
      const ruleId = editing && id ? id : (await createScheduleRule(db, payload)).id;
      if (editing && id) {
        await updateScheduleRule(db, id, payload);
      }
      await rebuildScheduleRuleEvents(db, ruleId);
      await rescheduleAllReminders(db);
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
      'Przyszłe, nieuzupełnione wydarzenia z tej reguły znikną z kalendarza.'
    );
    if (!ok) return;
    await deleteFutureScheduledEvents(db, id, toISODate(new Date()));
    await deleteScheduleRule(db, id);
    await rescheduleAllReminders(db);
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
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Włączone</Text>
            <Switch
              value={enabled}
              onValueChange={setEnabled}
              trackColor={{ true: colors.accent, false: colors.border }}
              thumbColor="#fff"
            />
          </View>

          <Text style={styles.help}>
            Aplikacja doda te treningi i mecze do kalendarza do końca aktywnego sezonu. Powiadomienie
            przyjdzie zaraz po godzinie zakończenia, żeby uzupełnić dojazd.
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
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 52,
  },
  switchLabel: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  help: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
});
