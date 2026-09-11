import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, space } from '@/constants/theme';
import { formatMoney } from '@/lib/format';
import type { Destination } from '@/lib/db/types';

export function DestinationRow({
  destination,
  selected,
  onPress,
}: {
  destination: Destination;
  selected?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        selected && styles.selected,
        pressed && styles.pressed,
      ]}>
      <View style={styles.body}>
        <Text style={styles.name}>{destination.name}</Text>
        <Text style={styles.meta}>
          {destination.address ? `${destination.address} · ` : ''}
          {formatMoney(destination.roundTripRate)} tam i z powrotem
          {destination.roundTripRate
            ? ` · ${formatMoney(destination.roundTripRate / 2)} jedna strona`
            : ''}
        </Text>
      </View>
      {selected ? <Text style={styles.check}>✓</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: space.md,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  selected: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  pressed: {
    opacity: 0.8,
  },
  body: {
    flex: 1,
    gap: 4,
  },
  name: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  meta: {
    color: colors.muted,
    fontSize: 13,
  },
  check: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
});
