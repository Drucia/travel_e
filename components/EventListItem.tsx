import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, space } from '@/constants/theme';
import { formatTimeRange } from '@/lib/dates';
import { EVENT_TYPE_EMOJI, EVENT_TYPE_LABEL } from '@/lib/format';
import type { EventRecord } from '@/lib/db/types';

export function EventListItem({
  event,
  onPress,
}: {
  event: EventRecord;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={styles.emojiWrap}>
        <Text style={styles.emoji}>{EVENT_TYPE_EMOJI[event.type]}</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.title}>{EVENT_TYPE_LABEL[event.type]}</Text>
        <Text style={styles.meta}>
          {formatTimeRange(event.startTime, event.endTime)}
          {event.destinationName ? ` · ${event.destinationName}` : ''}
        </Text>
      </View>
      {event.completed ? (
        <Ionicons name="checkmark-circle" size={22} color={colors.text} />
      ) : (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Uzupełnij</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: space.md,
  },
  pressed: {
    opacity: 0.78,
  },
  emojiWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 20,
  },
  body: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
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
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
});
