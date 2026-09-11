import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppButton, EmptyState, Screen } from '@/components/ui';
import { DestinationRow } from '@/components/DestinationRow';
import { colors, space } from '@/constants/theme';
import { useApp, useDb } from '@/context/AppContext';
import { confirmAction } from '@/lib/confirm';
import { deleteDestination } from '@/lib/db/queries';

export default function DestinationsScreen() {
  const { destinations, refresh } = useApp();
  const db = useDb();
  const router = useRouter();

  async function confirmDelete(id: string, name: string) {
    const ok = await confirmAction('Usunąć miejsce?', `${name} zniknie z listy. Wydarzenia pozostaną.`);
    if (!ok) return;
    await deleteDestination(db, id);
    await refresh();
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        {destinations.length === 0 ? (
          <EmptyState title="Brak miejsc" hint="Dodaj miejsca, do których zwykle dojeżdżasz." />
        ) : (
          <View style={styles.list}>
            {destinations.map((destination) => (
              <View key={destination.id} style={styles.item}>
                <DestinationRow
                  destination={destination}
                  onPress={() => router.push(`/destinations/${destination.id}`)}
                />
                <Pressable onPress={() => void confirmDelete(destination.id, destination.name)}>
                  <Text style={styles.delete}>Usuń</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}
        <AppButton label="Dodaj miejsce" onPress={() => router.push('/destinations/new')} />
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
  list: {
    gap: 12,
  },
  item: {
    gap: 6,
  },
  delete: {
    color: colors.danger,
    fontWeight: '700',
    alignSelf: 'flex-end',
    paddingHorizontal: 4,
  },
});
