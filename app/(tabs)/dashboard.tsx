import { useFocusEffect, useNavigation } from "expo-router";
import { useCallback, useLayoutEffect, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";

import { MonthHeader } from "@/components/calendar";
import { DateField, TextField } from "@/components/fields";
import { AppButton, Card, Screen, StatLine } from "@/components/ui";
import { colors, space } from "@/constants/theme";
import { useApp, useDb } from "@/context/AppContext";
import { monthRange, shiftMonth, toISODate } from "@/lib/dates";
import {
    getSettlement,
    listEventsBetween,
    listEventsBySeason,
    listSettlementsBetween,
    saveSettlement,
} from "@/lib/db/queries";
import type { EventRecord, Settlement } from "@/lib/db/types";
import { formatAttendance, formatMoney, labeledCount } from "@/lib/format";
import { computeStats } from "@/lib/stats";

export default function DashboardScreen() {
  const { activeSeason, destinations } = useApp();
  const db = useDb();
  const navigation = useNavigation();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [monthIndex, setMonthIndex] = useState(now.getMonth());
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [seasonEvents, setSeasonEvents] = useState<EventRecord[]>([]);
  const [settlement, setSettlement] = useState<Settlement | null>(null);
  const [seasonSettlements, setSeasonSettlements] = useState<Settlement[]>([]);
  const [receivedAmount, setReceivedAmount] = useState("");
  const [receivedDate, setReceivedDate] = useState(toISODate(now));
  const [savingSettlement, setSavingSettlement] = useState(false);
  const [showSettlementForm, setShowSettlementForm] = useState(false);

  const monthKey = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;

  const load = useCallback(async () => {
    try {
      const range = monthRange(year, monthIndex);
      const [
        nextEvents,
        nextSettlement,
        nextSeasonEvents,
        nextSeasonSettlements,
      ] = await Promise.all([
        listEventsBetween(db, range.start, range.end),
        getSettlement(db, monthKey),
        activeSeason
          ? listEventsBySeason(db, activeSeason.id)
          : Promise.resolve([]),
        activeSeason
          ? listSettlementsBetween(
              db,
              activeSeason.startDate.slice(0, 7),
              activeSeason.endDate.slice(0, 7),
            )
          : Promise.resolve([]),
      ]);
      setEvents(nextEvents);
      setSeasonEvents(nextSeasonEvents);
      setSettlement(nextSettlement);
      setSeasonSettlements(nextSeasonSettlements);
      setReceivedAmount(
        nextSettlement ? String(nextSettlement.amount).replace(".", ",") : "",
      );
      setReceivedDate(nextSettlement?.receivedDate ?? toISODate(new Date()));
    } catch (error) {
      console.warn("Nie udało się wczytać dashboardu", error);
    }
  }, [activeSeason, db, monthKey, year, monthIndex]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const stats = useMemo(
    () => computeStats(events, destinations),
    [events, destinations],
  );
  const seasonStats = useMemo(
    () => computeStats(seasonEvents, destinations),
    [seasonEvents, destinations],
  );
  const seasonReceivedAmount = useMemo(
    () => seasonSettlements.reduce((total, item) => total + item.amount, 0),
    [seasonSettlements],
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: "Dashboard",
      headerRight: () => (
        <Text style={styles.headerMoney}>
          {formatMoney(seasonReceivedAmount)} /{" "}
          {formatMoney(seasonStats.amount)}
        </Text>
      ),
    });
  }, [navigation, seasonReceivedAmount, seasonStats.amount]);

  function changeMonth(delta: number) {
    const next = shiftMonth(year, monthIndex, delta);
    setYear(next.year);
    setMonthIndex(next.monthIndex);
  }

  async function saveReceivedSettlement() {
    const amount = Number(receivedAmount.replace(",", "."));
    if (!Number.isFinite(amount) || amount < 0) {
      Alert.alert("Niepoprawna kwota", "Wpisz kwotę otrzymanego rozliczenia.");
      return;
    }
    setSavingSettlement(true);
    try {
      const saved = await saveSettlement(db, {
        month: monthKey,
        amount,
        receivedDate,
      });
      setSettlement(saved);
      setReceivedAmount(String(saved.amount).replace(".", ","));
      setShowSettlementForm(false);
      Alert.alert("Zapisano", "Otrzymane rozliczenie zostało zapisane.");
    } catch (error) {
      Alert.alert(
        "Nie udało się zapisać",
        error instanceof Error ? error.message : "Spróbuj ponownie.",
      );
    } finally {
      setSavingSettlement(false);
    }
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Card>
          <View style={styles.topRow}>
            <View style={styles.monthNav}>
              <MonthHeader
                year={year}
                monthIndex={monthIndex}
                onPrev={() => changeMonth(-1)}
                onNext={() => changeMonth(1)}
              />
            </View>
          </View>
          <AppButton
            label={
              showSettlementForm ? "Ukryj rozliczenie" : "Wpisz rozliczenie"
            }
            variant="secondary"
            icon={showSettlementForm ? "chevron-up" : "create-outline"}
            onPress={() => setShowSettlementForm((visible) => !visible)}
          />
          {showSettlementForm ? (
            <View style={styles.settlementForm}>
              <TextField
                label="Otrzymane rozliczenie"
                value={receivedAmount}
                onChangeText={setReceivedAmount}
                placeholder="np. 120,50"
                keyboardType="decimal-pad"
              />
              <DateField
                label="Data otrzymania"
                value={receivedDate}
                onChange={setReceivedDate}
              />
              <AppButton
                label={
                  savingSettlement ? "Zapisywanie..." : "Zapisz rozliczenie"
                }
                icon="checkmark"
                onPress={() => void saveReceivedSettlement()}
                disabled={savingSettlement}
              />
            </View>
          ) : null}
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
          <StatLine
            label="Wyjazdy"
            value={labeledCount(stats.trips, "wyjazd", "wyjazdy", "wyjazdów")}
          />
        </Card>

        <Card>
          <Text style={styles.section}>Rozliczenie</Text>
          <StatLine label="Wyjazdy" value={String(stats.trips)} />
          <StatLine
            label="Kwota do rozliczenia"
            value={formatMoney(stats.amount)}
            accent
          />
        </Card>

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
                      {labeledCount(
                        place.trips,
                        "wyjazd",
                        "wyjazdy",
                        "wyjazdów",
                      )}
                    </Text>
                  </View>
                  <Text style={styles.placeKm}>
                    {formatMoney(place.amount)}
                  </Text>
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
  headerMoney: {
    color: colors.muted,
    fontSize: 16,
    fontWeight: "800",
    textAlign: "right",
    marginRight: space.md,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.sm,
  },
  monthNav: {
    flex: 1,
    minWidth: 190,
  },
  settlementForm: {
    gap: space.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: space.md,
  },
  section: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  placeName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  placeMeta: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 2,
  },
  placeKm: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: "hidden",
  },
});
