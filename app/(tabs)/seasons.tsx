import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppButton, Card, EmptyState, Screen } from '@/components/ui';
import { colors, radius, space } from '@/constants/theme';
import { useApp } from '@/context/AppContext';
import { formatDayLong } from '@/lib/dates';

export default function SeasonsScreen() {
  const { seasons } = useApp();
  const router = useRouter();

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.hint}>Historia sezonów zostaje zachowana po starcie nowego sezonu.</Text>

        {seasons.length === 0 ? (
          <Card>
            <EmptyState title="Brak sezonów" hint="Utwórz pierwszy sezon, aby dodać wydarzenia." />
          </Card>
        ) : (
          <View style={styles.list}>
            {seasons.map((season) => (
              <Pressable
                key={season.id}
                onPress={() => router.push(`/season/${season.id}`)}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
                <View style={styles.body}>
                  <Text style={styles.name}>{season.name}</Text>
                  <Text style={styles.meta}>
                    {formatDayLong(season.startDate)} – {formatDayLong(season.endDate)}
                  </Text>
                </View>
                {season.active ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>Aktywny</Text>
                  </View>
                ) : (
                  <Text style={styles.chevron}>›</Text>
                )}
              </Pressable>
            ))}
          </View>
        )}

        <AppButton label="Nowy sezon" onPress={() => router.push('/season/new')} />
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
  hint: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  list: {
    gap: 10,
  },
  row: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pressed: {
    opacity: 0.78,
  },
  body: {
    flex: 1,
    gap: 4,
  },
  name: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  meta: {
    color: colors.muted,
    fontSize: 13,
  },
  badge: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.text,
  },
  chevron: {
    fontSize: 28,
    color: colors.muted,
    marginTop: -4,
  },
});
