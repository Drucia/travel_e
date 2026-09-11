import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DestinationRow } from '@/components/DestinationRow';
import { DateField, TextField, TimeField } from '@/components/fields';
import { AppButton, ChoiceGroup, Screen, SectionLabel } from '@/components/ui';
import { colors, radius, space } from '@/constants/theme';
import { useApp } from '@/context/AppContext';
import { createEventForUser, getEvent, updateEventForUser } from '@/lib/cloud/queries';
import { toISODate } from '@/lib/dates';
import type { EventType } from '@/lib/db/types';
import { scheduleEventReminder } from '@/lib/notifications';

export default function EventFormScreen() {
  const { date, id } = useLocalSearchParams<{ date?: string; id?: string }>();
  const { seasons, destinations, activeSeason, refresh, group, userId, settings } = useApp();
  const router = useRouter();
  const editing = Boolean(id);

  const [type, setType] = useState<EventType>('training');
  const [eventDate, setEventDate] = useState(date ?? toISODate(new Date()));
  const [startTime, setStartTime] = useState('18:00');
  const [endTime, setEndTime] = useState<string | null>(null);
  const [seasonId, setSeasonId] = useState(activeSeason?.id ?? '');
  const [destinationId, setDestinationId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id && activeSeason && !seasonId) {
      setSeasonId(activeSeason.id);
    }
  }, [activeSeason, id, seasonId]);

  useEffect(() => {
    if (!id || !userId) return;
    void (async () => {
      const event = await getEvent(id, userId, destinations);
      if (!event) return;
      setType(event.type);
      setEventDate(event.date);
      setStartTime(event.startTime);
      setEndTime(event.endTime);
      setSeasonId(event.seasonId);
      setDestinationId(event.destinationId);
      setNotes(event.notes ?? '');
    })();
  }, [destinations, id, userId]);

  async function save() {
    if (!group || !userId) {
      Alert.alert('Brak grupy', 'Najpierw dołącz do grupy.');
      return;
    }
    if (!seasonId) {
      Alert.alert('Brak sezonu', 'Najpierw utwórz sezon.');
      return;
    }
    setSaving(true);
    try {
      const draft = {
        type,
        date: eventDate,
        startTime,
        endTime,
        seasonId,
        destinationId,
        notes: notes.trim() || null,
      };
      const event =
        editing && id
          ? await updateEventForUser(id, userId, draft, destinations)
          : await createEventForUser(group.id, userId, draft, destinations);
      await scheduleEventReminder(event, settings);
      await refresh();
      if (editing) {
        router.back();
      } else {
        router.replace(`/event/${event.id}`);
      }
    } catch (error) {
      Alert.alert('Nie udało się zapisać', error instanceof Error ? error.message : 'Spróbuj ponownie.');
    } finally {
      setSaving(false);
    }
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

          <DateField label="Data" value={eventDate} onChange={setEventDate} />
          <TimeField label="Godzina rozpoczęcia" value={startTime} onChange={(value) => value && setStartTime(value)} />
          <TimeField label="Godzina zakończenia" value={endTime} onChange={setEndTime} optional />

          <SectionLabel>Sezon</SectionLabel>
          <View style={styles.seasonList}>
            {seasons.map((season) => {
              const selected = season.id === seasonId;
              return (
                <Pressable
                  key={season.id}
                  onPress={() => setSeasonId(season.id)}
                  style={[styles.seasonChip, selected && styles.seasonChipSelected]}>
                  <Text style={styles.seasonChipText}>{season.name}</Text>
                </Pressable>
              );
            })}
          </View>

          <SectionLabel>Miejsce docelowe</SectionLabel>
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
            <AppButton
              label="Dodaj miejsce"
              variant="secondary"
              onPress={() => router.push('/destinations/new')}
            />
          </View>

          <TextField
            label="Notatka"
            value={notes}
            onChangeText={setNotes}
            placeholder="Opcjonalnie"
            multiline
          />

          <AppButton label={saving ? 'Zapisywanie…' : 'Zapisz'} onPress={() => void save()} disabled={saving} />
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
  seasonList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  seasonChip: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  seasonChipSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  seasonChipText: {
    color: colors.text,
    fontWeight: '700',
  },
  list: {
    gap: 8,
  },
});
