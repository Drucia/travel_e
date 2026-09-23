import { useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { AppButton, Card, Screen, SettingRow } from '@/components/ui';
import { colors, radius, space } from '@/constants/theme';
import { useApp, useDb } from '@/context/AppContext';
import { formatTimeRange } from '@/lib/dates';
import { listIncompleteEvents, updateSettings } from '@/lib/db/queries';
import { EVENT_TYPE_EMOJI, EVENT_TYPE_LABEL, formatWeekdays } from '@/lib/format';
import { ensureNotificationSetup, rescheduleAllReminders } from '@/lib/notifications';

export default function SettingsScreen() {
  const db = useDb();
  const { settings, activeSeason, destinations, scheduleRules, refresh } = useApp();
  const router = useRouter();

  async function toggleReminders(enabled: boolean) {
    if (enabled) {
      const allowed = await ensureNotificationSetup();
      if (!allowed) {
        Alert.alert('Brak zgody', 'Włącz powiadomienia w ustawieniach telefonu, aby otrzymywać przypomnienia.');
        return;
      }
    }
    const next = await updateSettings(db, { reminderEnabled: enabled });
    const incomplete = await listIncompleteEvents(db);
    await rescheduleAllReminders(next, incomplete);
    await refresh();
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card>
          <Text style={styles.section}>Sezony</Text>
          <SettingRow
            label="Aktywny sezon"
            value={activeSeason?.name ?? 'Brak'}
            onPress={() => router.push('/seasons')}
          />
        </Card>

        <Card>
          <Text style={styles.section}>Harmonogram</Text>
          <Text style={styles.helpTop}>
            Ustaw stałe dni treningów i meczów. Aplikacja sama doda je w kalendarzu i przypomni po
            zakończeniu, żeby uzupełnić dojazd.
          </Text>
          {scheduleRules.length === 0 ? (
            <Text style={styles.empty}>Brak stałych dni.</Text>
          ) : (
            <View style={styles.rules}>
              {scheduleRules.map((rule) => {
                const place = destinations.find((item) => item.id === rule.destinationId);
                return (
                  <Pressable
                    key={rule.id}
                    onPress={() => router.push(`/schedule/${rule.id}`)}
                    style={({ pressed }) => [styles.rule, pressed && styles.pressed]}>
                    <Text style={styles.ruleTitle}>
                      {EVENT_TYPE_EMOJI[rule.type]} {EVENT_TYPE_LABEL[rule.type]}
                      {rule.enabled ? '' : ' · wyłączone'}
                    </Text>
                    <Text style={styles.ruleMeta}>
                      {formatWeekdays(rule.weekdays)} · {formatTimeRange(rule.startTime, rule.endTime)}
                      {place ? ` · ${place.name}` : ''}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
          <AppButton label="Dodaj dni" onPress={() => router.push('/schedule/new')} />
        </Card>

        <Card>
          <Text style={styles.section}>Miejsca i stawki</Text>
          <SettingRow
            label="Zapisane miejsca"
            value={String(destinations.length)}
            onPress={() => router.push('/destinations')}
          />
          <Text style={styles.help}>
            Stawkę ustawiasz przy miejscu, np. Gniechowice 30 zł tam i z powrotem. Jedna strona liczy się
            jako połowa.
          </Text>
        </Card>

        <Card>
          <Text style={styles.section}>Powiadomienia</Text>
          <SettingRow label="Przypomnienia po treningu">
            <Switch
              value={settings.reminderEnabled}
              onValueChange={(value) => void toggleReminders(value)}
              trackColor={{ true: colors.accent, false: colors.border }}
              thumbColor="#fff"
            />
          </SettingRow>
          <Text style={styles.help}>
            Powiadomienie przyjdzie zaraz po godzinie zakończenia treningu lub meczu i otworzy formularz
            dojazdu.
          </Text>
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
  helpTop: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  help: {
    marginTop: 10,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  empty: {
    color: colors.muted,
    marginBottom: 12,
  },
  rules: {
    gap: 8,
    marginBottom: 12,
  },
  rule: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: 12,
  },
  pressed: {
    opacity: 0.75,
  },
  ruleTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  ruleMeta: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 3,
  },
});
