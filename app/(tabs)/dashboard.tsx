import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { MonthHeader } from '@/components/calendar';
import { Banner, Card, Screen, StatLine } from '@/components/ui';
import { colors, space } from '@/constants/theme';
import { useApp } from '@/context/AppContext';
import { listCloudEvents, listEventsBetween, listResponsesForEvents, toEventRecord } from '@/lib/cloud/queries';
import { monthRange, shiftMonth } from '@/lib/dates';
import type { EventRecord } from '@/lib/db/types';
import { formatAttendance, formatMoney, labeledCount } from '@/lib/format';
import { computeStats } from '@/lib/stats';

type MemberLine = {
  userId: string;
  name: string;
  trips: number;
  amount: number;
};

export default function DashboardScreen() {
  const { destinations, group, userId, members, cloudError } = useApp();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [monthIndex, setMonthIndex] = useState(now.getMonth());
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [groupLines, setGroupLines] = useState<MemberLine[]>([]);

  const load = useCallback(async () => {
    if (!group || !userId) {
      setEvents([]);
      setGroupLines([]);
      return;
    }
    try {
      const range = monthRange(year, monthIndex);
      const mine = await listEventsBetween(group.id, userId, range.start, range.end);
      setEvents(mine);

      if (members.length <= 1) {
        setGroupLines([]);
        return;
      }

      const shared = await listCloudEvents(group.id, range.start, range.end);
      const responses = await listResponsesForEvents(shared.map((item) => item.id));
      const lines = members.map((member) => {
        const merged = shared.map((event) =>
          toEventRecord(
            event,
            responses.find((item) => item.eventId === event.id && item.userId === member.userId) ?? null,
            destinations
          )
        );
        const stats = computeStats(merged, destinations);
        return {
          userId: member.userId,
          name: member.userId === userId ? 'Ty' : member.displayName,
          trips: stats.trips,
          amount: stats.amount,
        };
      });
      setGroupLines(lines);
    } catch (error) {
      console.warn('Nie udało się wczytać dashboardu', error);
    }
  }, [destinations, group, members, userId, year, monthIndex]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const stats = useMemo(() => computeStats(events, destinations), [events, destinations]);

  function changeMonth(delta: number) {
    const next = shiftMonth(year, monthIndex, delta);
    setYear(next.year);
    setMonthIndex(next.monthIndex);
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {cloudError ? <Banner text={cloudError} /> : null}
        <Card>
          <MonthHeader year={year} monthIndex={monthIndex} onPrev={() => changeMonth(-1)} onNext={() => changeMonth(1)} />
        </Card>

        <Card>
          <StatLine
            label="Obecność · treningi"
            value={formatAttendance(stats.attendedTrainings, stats.trainings)}
          />
          <StatLine
            label="Obecność · mecze"
            value={formatAttendance(stats.attendedMatches, stats.matches)}
          />
          <StatLine label="Wyjazdy" value={labeledCount(stats.trips, 'wyjazd', 'wyjazdy', 'wyjazdów')} />
          <StatLine
            label="Wyjazdy samochodem"
            value={labeledCount(stats.carTrips, 'wyjazd', 'wyjazdy', 'wyjazdów')}
          />
        </Card>

        <Card>
          <Text style={styles.section}>Moje rozliczenie</Text>
          <StatLine label="Wyjazdy" value={String(stats.trips)} />
          <StatLine label="Kwota do rozliczenia" value={formatMoney(stats.amount)} accent />
        </Card>

        {groupLines.length > 1 ? (
          <Card>
            <Text style={styles.section}>Grupa</Text>
            {groupLines.map((line) => (
              <StatLine
                key={line.userId}
                label={line.name}
                value={`${line.trips} · ${formatMoney(line.amount)}`}
              />
            ))}
          </Card>
        ) : null}

        <Card>
          <Text style={styles.section}>Miejsca</Text>
          {stats.byPlace.length === 0 ? (
            <Text style={styles.empty}>Brak wyjazdów w tym miesiącu.</Text>
          ) : (
            <View style={styles.places}>
              {stats.byPlace.map((place) => (
                <View key={place.destinationId} style={styles.placeRow}>
                  <View>
                    <Text style={styles.placeName}>{place.name}</Text>
                    <Text style={styles.placeMeta}>
                      {labeledCount(place.trips, 'wyjazd', 'wyjazdy', 'wyjazdów')}
                    </Text>
                  </View>
                  <Text style={styles.placeKm}>{formatMoney(place.amount)}</Text>
                </View>
              ))}
            </View>
          )}
        </Card>
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
  section: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  empty: {
    color: colors.muted,
    fontSize: 15,
  },
  places: {
    gap: 12,
  },
  placeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  placeName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  placeMeta: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 2,
  },
  placeKm: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
});
