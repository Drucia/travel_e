import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DestinationRow } from '@/components/DestinationRow';
import { TextField } from '@/components/fields';
import { AppButton, Card, ChoiceGroup, Screen, SectionLabel } from '@/components/ui';
import { colors, space } from '@/constants/theme';
import { useApp, useDb } from '@/context/AppContext';
import { confirmAction } from '@/lib/confirm';
import { formatDayLong, formatTimeRange } from '@/lib/dates';
import { completeEvent, deleteEvent, getEvent, updateEventNotes } from '@/lib/db/queries';
import type { EventRecord, Transport, TripDirection } from '@/lib/db/types';
import { EVENT_TYPE_EMOJI, EVENT_TYPE_LABEL, formatMoney, tripAmount } from '@/lib/format';
import { cancelEventReminder, syncEventReminder } from '@/lib/notifications';

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const db = useDb();
  const { destinations, refresh, settings } = useApp();

  const [event, setEvent] = useState<EventRecord | null>(null);
  const [attended, setAttended] = useState<boolean | null>(null);
  const [traveled, setTraveled] = useState<boolean | null>(null);
  const [transport, setTransport] = useState<Transport | null>(null);
  const [destinationId, setDestinationId] = useState<string | null>(null);
  const [tripDirection, setTripDirection] = useState<TripDirection | null>('round_trip');
  const [absenceNote, setAbsenceNote] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const next = await getEvent(db, id);
    setEvent(next);
    if (!next) return;
    setAttended(next.attended);
    setTraveled(next.traveled);
    setTransport(next.transport);
    setDestinationId(next.destinationId);
    setTripDirection(next.tripDirection ?? (next.traveled ? 'round_trip' : null));
    setAbsenceNote(next.absenceNote ?? '');
    setNotes(next.notes ?? '');
  }, [db, id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const notesValue = notes.trim() || null;
  const notesChanged = notesValue !== (event?.notes ?? null);
  const canSaveCompletion =
    attended === false ||
    (attended === true && traveled === false) ||
    (attended === true &&
      traveled === true &&
      transport !== null &&
      destinationId !== null &&
      tripDirection !== null);
  const canSave = canSaveCompletion || notesChanged;

  async function save() {
    if (!id || !canSave) return;
    setSaving(true);
    try {
      const updated = canSaveCompletion && attended !== null
        ? await completeEvent(db, id, {
            attended,
            absenceNote: absenceNote.trim() || null,
            traveled,
            transport,
            destinationId,
            tripDirection,
            notes: notesValue,
          })
        : await updateEventNotes(db, id, notesValue);
      await syncEventReminder(updated, settings);
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
    const ok = await confirmAction('Usunąć wydarzenie?', 'Zniknie z kalendarza. Tej operacji nie można cofnąć.');
    if (!ok) return;
    await cancelEventReminder(id);
    await deleteEvent(db, id);
    await refresh();
    router.back();
  }

  const selectedDestination = destinations.find((item) => item.id === destinationId) ?? null;

  if (!event) {
    return (
      <Screen>
        <Text style={styles.missing}>Nie znaleziono wydarzenia.</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Card>
            <Text style={styles.kicker}>{EVENT_TYPE_EMOJI[event.type]} {EVENT_TYPE_LABEL[event.type]}</Text>
            <Text style={styles.title}>{formatDayLong(event.date)}</Text>
            <Text style={styles.meta}>{formatTimeRange(event.startTime, event.endTime)}</Text>
            {event.destinationName ? <Text style={styles.meta}>{event.destinationName}</Text> : null}
          </Card>

          <TextField
            label="Notatka"
            value={notes}
            onChangeText={setNotes}
            placeholder="np. zbiórka 17:45, inny dojazd"
            multiline
          />

          <SectionLabel>Czy byłam?</SectionLabel>
          <ChoiceGroup
            options={[
              { label: 'TAK', value: 'yes' },
              { label: 'NIE', value: 'no' },
            ]}
            value={attended === null ? null : attended ? 'yes' : 'no'}
            onChange={(value) => {
              const next = value === 'yes';
              setAttended(next);
              if (!next) {
                setTraveled(null);
                setTransport(null);
                setTripDirection(null);
              }
            }}
          />

          {attended === false ? (
            <TextField
              label="Powód / notatka"
              value={absenceNote}
              onChangeText={setAbsenceNote}
              placeholder="Opcjonalnie"
              multiline
            />
          ) : null}

          {attended === true ? (
            <>
              <SectionLabel>Czy jechałam?</SectionLabel>
              <ChoiceGroup
                options={[
                  { label: 'TAK', value: 'yes' },
                  { label: 'NIE', value: 'no' },
                ]}
                value={traveled === null ? null : traveled ? 'yes' : 'no'}
                onChange={(value) => {
                  const next = value === 'yes';
                  setTraveled(next);
                  if (!next) {
                    setTransport(null);
                    setTripDirection(null);
                  } else if (!tripDirection) {
                    setTripDirection('round_trip');
                  }
                }}
              />
            </>
          ) : null}

          {attended === true && traveled === true ? (
            <>
              <SectionLabel>Środek transportu</SectionLabel>
              <ChoiceGroup
                options={[
                  { label: 'Samochód', value: 'car' },
                  { label: 'Inny', value: 'other' },
                ]}
                value={transport}
                onChange={setTransport}
              />

              <SectionLabel>Dokąd dojechałam?</SectionLabel>
              <View style={styles.list}>
                {destinations.map((destination) => (
                  <DestinationRow
                    key={destination.id}
                    destination={destination}
                    selected={destination.id === destinationId}
                    onPress={() => setDestinationId(destination.id)}
                  />
                ))}
                <AppButton
                  label="Dodaj miejsce"
                  variant="secondary"
                  onPress={() => router.push('/destinations/new')}
                />
              </View>

              <SectionLabel>Jaki wyjazd?</SectionLabel>
              <ChoiceGroup
                options={[
                  { label: 'Tam', value: 'outbound' },
                  { label: 'Powrót', value: 'return' },
                  { label: 'Tam i z powrotem', value: 'round_trip' },
                ]}
                value={tripDirection}
                onChange={setTripDirection}
              />
              {selectedDestination ? (
                <Text style={styles.payHint}>
                  Do rozliczenia: {formatMoney(tripAmount(selectedDestination.roundTripRate, tripDirection))}
                </Text>
              ) : (
                <Text style={styles.payHint}>Wybierz miejsce, żeby zobaczyć kwotę.</Text>
              )}
            </>
          ) : null}

          <AppButton
            label={
              saving
                ? 'Zapisywanie…'
                : canSaveCompletion
                  ? event.completed
                    ? 'Zapisz zmiany'
                    : 'Zapisz'
                  : 'Zapisz notatkę'
            }
            onPress={() => void save()}
            disabled={!canSave || saving}
          />
          <AppButton label="Edytuj szczegóły" variant="secondary" onPress={() => router.push(`/event/form?id=${event.id}`)} />
          <AppButton label="Usuń wydarzenie" variant="danger" onPress={() => void confirmDelete()} />
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
  kicker: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  title: {
    marginTop: 6,
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
  },
  meta: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 15,
  },
  list: {
    gap: 8,
  },
  payHint: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    backgroundColor: colors.accentSoft,
    overflow: 'hidden',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  missing: {
    padding: space.lg,
    color: colors.muted,
  },
});
