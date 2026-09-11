import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius } from '@/constants/theme';
import { WEEKDAYS_PL, buildMonthGrid, formatMonthTitle, toISODate } from '@/lib/dates';
import { EVENT_TYPE_EMOJI } from '@/lib/format';
import type { EventRecord } from '@/lib/db/types';

export type DayMarkers = Record<
  string,
  {
    training: boolean;
    match: boolean;
    incomplete: boolean;
  }
>;

export function markersFromEvents(events: EventRecord[]): DayMarkers {
  const markers: DayMarkers = {};
  for (const event of events) {
    const current = markers[event.date] ?? { training: false, match: false, incomplete: false };
    if (event.type === 'training') current.training = true;
    if (event.type === 'match') current.match = true;
    if (!event.completed) current.incomplete = true;
    markers[event.date] = current;
  }
  return markers;
}

export function MonthHeader({
  year,
  monthIndex,
  onPrev,
  onNext,
}: {
  year: number;
  monthIndex: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <View style={styles.header}>
      <Pressable onPress={onPrev} hitSlop={12} style={styles.navBtn}>
        <Ionicons name="chevron-back" size={22} color={colors.text} />
      </Pressable>
      <Text style={styles.monthTitle}>{formatMonthTitle(year, monthIndex)}</Text>
      <Pressable onPress={onNext} hitSlop={12} style={styles.navBtn}>
        <Ionicons name="chevron-forward" size={22} color={colors.text} />
      </Pressable>
    </View>
  );
}

export function CalendarMonth({
  year,
  monthIndex,
  selectedDate,
  markers,
  onSelectDate,
}: {
  year: number;
  monthIndex: number;
  selectedDate: string;
  markers: DayMarkers;
  onSelectDate: (date: string) => void;
}) {
  const today = toISODate(new Date());
  const cells = buildMonthGrid(year, monthIndex);

  return (
    <View>
      <View style={styles.weekRow}>
        {WEEKDAYS_PL.map((day) => (
          <Text key={day} style={styles.weekday}>
            {day}
          </Text>
        ))}
      </View>
      <View style={styles.grid}>
        {cells.map((day, index) => {
          if (!day) {
            return <View key={`empty-${index}`} style={styles.cell} />;
          }
          const date = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const isToday = date === today;
          const selected = date === selectedDate;
          const marker = markers[date];

          return (
            <Pressable key={date} onPress={() => onSelectDate(date)} style={styles.cell}>
              <View
                style={[
                  styles.dayInner,
                  selected && styles.daySelected,
                  isToday && !selected && styles.dayToday,
                ]}>
                <Text style={[styles.dayNumber, (selected || isToday) && styles.dayNumberStrong]}>
                  {day}
                </Text>
                <View style={styles.marks}>
                  {marker?.training ? <Text style={styles.emoji}>{EVENT_TYPE_EMOJI.training}</Text> : null}
                  {marker?.match ? <Text style={styles.emoji}>{EVENT_TYPE_EMOJI.match}</Text> : null}
                  {marker?.incomplete ? (
                    <View style={[styles.dot, selected && styles.dotOnSelected]} />
                  ) : null}
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  weekday: {
    flex: 1,
    textAlign: 'center',
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: '14.2857%',
    aspectRatio: 0.9,
    padding: 2,
  },
  dayInner: {
    flex: 1,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  daySelected: {
    backgroundColor: colors.accent,
  },
  dayToday: {
    backgroundColor: colors.accentSoft,
  },
  dayNumber: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  dayNumberStrong: {
    fontWeight: '800',
  },
  marks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
    minHeight: 12,
  },
  emoji: {
    fontSize: 10,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
    borderWidth: 1,
    borderColor: '#C9A000',
  },
  dotOnSelected: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
});
