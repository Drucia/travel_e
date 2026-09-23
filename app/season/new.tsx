import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';

import { DateField, TextField } from '@/components/fields';
import { AppButton, FormSwitch, Screen } from '@/components/ui';
import { space } from '@/constants/theme';
import { useApp, useDb } from '@/context/AppContext';
import { currentSeasonWindow } from '@/lib/dates';
import { createSeason } from '@/lib/db/queries';
import { generateScheduleEvents } from '@/lib/schedule';

export default function NewSeasonScreen() {
  const router = useRouter();
  const { refresh } = useApp();
  const db = useDb();
  const seed = currentSeasonWindow();
  const [name, setName] = useState(seed.name);
  const [startDate, setStartDate] = useState(seed.startDate);
  const [endDate, setEndDate] = useState(seed.endDate);
  const [active, setActive] = useState(true);
  const [includePast, setIncludePast] = useState(true);
  const [saving, setSaving] = useState(false);

  async function save() {
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
      const season = await createSeason(db, {
        name,
        startDate,
        endDate,
        active,
      });
      if (season.active) {
        await generateScheduleEvents(db, { includePast });
      }
      await refresh();
      router.replace(`/season/${season.id}`);
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
          <TextField label="Nazwa" value={name} onChangeText={setName} placeholder="Sezon 2026/2027" />
          <DateField label="Data rozpoczęcia" value={startDate} onChange={setStartDate} />
          <DateField label="Data zakończenia" value={endDate} onChange={setEndDate} />
          <FormSwitch label="Ustaw jako aktywny" value={active} onValueChange={setActive} />
          <FormSwitch
            label="Dopisz treningi z harmonogramu wstecz"
            value={includePast}
            onValueChange={setIncludePast}
            hint="Kalendarz uzupełni stałe dni od daty rozpoczęcia sezonu, nie tylko od dziś."
          />
          <AppButton
            label={active ? 'Zapisz i ustaw jako aktywny' : 'Zapisz sezon'}
            onPress={() => void save()}
            disabled={saving}
          />
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
});
