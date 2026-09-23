import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';

import { TextField } from '@/components/fields';
import { AppButton, Screen } from '@/components/ui';
import { colors, space } from '@/constants/theme';
import { useApp, useDb } from '@/context/AppContext';
import { createDestination, getDestination, updateDestination } from '@/lib/db/queries';
import { formatMoney } from '@/lib/format';

export default function DestinationFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const { refresh } = useApp();
  const db = useDb();
  const editing = Boolean(id);

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [rate, setRate] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      const destination = await getDestination(db, id);
      if (!destination) return;
      setName(destination.name);
      setAddress(destination.address ?? '');
      setRate(String(destination.roundTripRate).replace('.', ','));
    })();
  }, [db, id]);

  const parsedRate = Number(rate.replace(',', '.'));
  const oneWayRate = Number.isNaN(parsedRate) ? 0 : parsedRate / 2;

  async function save() {
    if (!name.trim()) {
      Alert.alert('Nazwa jest wymagana');
      return;
    }
    if (Number.isNaN(parsedRate) || parsedRate < 0) {
      Alert.alert('Podaj stawkę za wyjazd tam i z powrotem');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name,
        address: address.trim() || null,
        roundTripRate: parsedRate,
      };
      if (editing && id) {
        await updateDestination(db, id, payload);
      } else {
        await createDestination(db, payload);
      }
      await refresh();
      router.back();
    } catch (error) {
      Alert.alert('Nie udało się zapisać', error instanceof Error ? error.message : 'Spróbuj ponownie.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content}>
          <TextField label="Nazwa" value={name} onChangeText={setName} placeholder="Gniechowice" />
          <TextField
            label="Adres / opis"
            value={address}
            onChangeText={setAddress}
            placeholder="Opcjonalnie"
          />
          <TextField
            label="Stawka tam i z powrotem (zł)"
            value={rate}
            onChangeText={setRate}
            keyboardType="decimal-pad"
            placeholder="30"
          />
          {parsedRate > 0 ? (
            <Text style={styles.hint}>
              Tam albo powrót: {formatMoney(oneWayRate)}
            </Text>
          ) : (
            <Text style={styles.hint}>
              Podaj kwotę za cały wyjazd. Jedna strona będzie liczona jako połowa.
            </Text>
          )}
          <AppButton label={saving ? 'Zapisywanie…' : 'Zapisz miejsce'} onPress={() => void save()} disabled={saving} />
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
  },
  hint: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
});
