import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { EventListItem } from '@/components/EventListItem';
import { CalendarMonth, MonthHeader, markersFromEvents } from '@/components/calendar';
import { Card, EmptyState, Screen } from '@/components/ui';
import { colors, radius, space } from '@/constants/theme';
import { useApp, useDb } from '@/context/AppContext';
import { formatDayLong, shiftMonth, toISODate, monthRange } from '@/lib/dates';
import { listEventsBetween } from '@/lib/db/queries';
import type { EventRecord } from '@/lib/db/types';

export default function CalendarScreen() {
  const db = useDb();
  const { activeSeason } = useApp();
  const router = useRouter();
  const today = toISODate(new Date());
  const initial = new Date();

  const [year, setYear] = useState(initial.getFullYear());
  const [monthIndex, setMonthIndex] = useState(initial.getMonth());
  const [selectedDate, setSelectedDate] = useState(today);
  const [events, setEvents] = useState<EventRecord[]>([]);

  const load = useCallback(async () => {
    const range = monthRange(year, monthIndex);
    const rows = await listEventsBetween(db, range.start, range.end);
    setEvents(rows);
  }, [db, year, monthIndex]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const markers = useMemo(() => markersFromEvents(events), [events]);
  const dayEvents = events.filter((event) => event.date === selectedDate);
  const todayEvents = events.filter((event) => event.date === today);

  function changeMonth(delta: number) {
    const next = shiftMonth(year, monthIndex, delta);
    setYear(next.year);
    setMonthIndex(next.monthIndex);
    const nextSelected =
      next.year === initial.getFullYear() && next.monthIndex === initial.getMonth()
        ? today
        : `${next.year}-${String(next.monthIndex + 1).padStart(2, '0')}-01`;
    setSelectedDate(nextSelected);
  }

  function openNew() {
    router.push({ pathname: '/event/form', params: { date: selectedDate } });
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {activeSeason ? <Text style={styles.season}>{activeSeason.name}</Text> : null}

        {todayEvents.length > 0 ? (
          <Pressable
            onPress={() => {
              setYear(initial.getFullYear());
              setMonthIndex(initial.getMonth());
              setSelectedDate(today);
            }}
            style={styles.todayBanner}>
            <Text style={styles.todayBannerLabel}>Dzisiaj</Text>
            <Text style={styles.todayBannerText}>
              {todayEvents.length === 1
                ? `${todayEvents[0].type === 'match' ? '🏆 Mecz' : '🏐 Trening'} ${todayEvents[0].startTime}`
                : `${todayEvents.length} wydarzenia`}
              {todayEvents.some((event) => !event.completed) ? ' · do uzupełnienia' : ''}
            </Text>
          </Pressable>
        ) : null}

        <Card>
          <MonthHeader
            year={year}
            monthIndex={monthIndex}
            onPrev={() => changeMonth(-1)}
            onNext={() => changeMonth(1)}
          />
          <CalendarMonth
            year={year}
            monthIndex={monthIndex}
            selectedDate={selectedDate}
            markers={markers}
            onSelectDate={setSelectedDate}
          />
          <View style={styles.legend}>
            <Text style={styles.legendItem}>🏐 trening</Text>
            <Text style={styles.legendItem}>🏆 mecz</Text>
            <Text style={styles.legendItem}>● do uzupełnienia</Text>
          </View>
        </Card>

        <View style={styles.dayHeader}>
          <Text style={styles.dayTitle}>{formatDayLong(selectedDate)}</Text>
        </View>

        {dayEvents.length === 0 ? (
          <Card>
            <EmptyState title="Brak wydarzeń" hint="Dodaj trening lub mecz na ten dzień." />
          </Card>
        ) : (
          <View style={styles.list}>
            {dayEvents.map((event) => (
              <EventListItem
                key={event.id}
                event={event}
                onPress={() => router.push(`/event/${event.id}`)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <Pressable onPress={openNew} style={styles.fab} accessibilityLabel="Dodaj wydarzenie">
        <Ionicons name="add" size={28} color={colors.text} />
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: space.md,
    paddingBottom: 120,
    gap: space.md,
  },
  season: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  todayBanner: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: 12,
  },
  todayBannerLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.text,
  },
  todayBannerText: {
    marginTop: 2,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  dayHeader: {
    marginTop: 4,
  },
  dayTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  legendItem: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  list: {
    gap: 10,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    boxShadow: '0 4px 8px rgba(0,0,0,0.16)',
  },
});
