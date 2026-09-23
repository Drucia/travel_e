import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { AppButton, Card, Screen, SettingRow } from '@/components/ui';
import { PwaInstallHint } from '@/components/PwaInstallHint';
import { colors, radius, space } from '@/constants/theme';
import { useApp, useDb } from '@/context/AppContext';
import { createBackup, deviceBackupInfo, parseBackup, restoreBackup, type DeviceBackupInfo } from '@/lib/backup';
import {
  downloadOrShareBackup,
  loadDeviceCopy,
  pickBackupFile,
  saveDeviceCopy,
} from '@/lib/backupStorage';
import { confirmAction } from '@/lib/confirm';
import { formatTimeRange } from '@/lib/dates';
import { listIncompleteEvents, updateSettings } from '@/lib/db/queries';
import { EVENT_TYPE_EMOJI, EVENT_TYPE_LABEL, formatWeekdays } from '@/lib/format';
import { ensureNotificationSetup, rescheduleAllReminders } from '@/lib/notifications';

export default function SettingsScreen() {
  const db = useDb();
  const { settings, activeSeason, destinations, scheduleRules, refresh } = useApp();
  const router = useRouter();
  const [deviceCopy, setDeviceCopy] = useState<DeviceBackupInfo | null>(null);
  const [busy, setBusy] = useState(false);

  const reloadDeviceCopy = useCallback(async () => {
    try {
      setDeviceCopy(deviceBackupInfo(await loadDeviceCopy()));
    } catch {
      setDeviceCopy(null);
    }
  }, []);

  useEffect(() => {
    void reloadDeviceCopy();
  }, [reloadDeviceCopy]);

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

  async function exportToFile() {
    setBusy(true);
    try {
      const backup = await createBackup(db);
      await saveDeviceCopy(backup);
      await downloadOrShareBackup(backup);
      await reloadDeviceCopy();
    } catch (error) {
      Alert.alert('Nie udało się zapisać pliku', error instanceof Error ? error.message : 'Spróbuj ponownie.');
    } finally {
      setBusy(false);
    }
  }

  async function applyBackup(backup: ReturnType<typeof parseBackup>, warning: string) {
    const ok = await confirmAction(
      'Wczytać kopię?',
      warning,
      'Wczytaj'
    );
    if (!ok) return;
    setBusy(true);
    try {
      await restoreBackup(db, backup);
      await saveDeviceCopy(backup);
      await refresh();
      await reloadDeviceCopy();
      Alert.alert('Gotowe', 'Ewidencja została wczytana z kopii.');
    } catch (error) {
      Alert.alert('Nie udało się wczytać', error instanceof Error ? error.message : 'Spróbuj ponownie.');
    } finally {
      setBusy(false);
    }
  }

  async function importFromFile() {
    try {
      const raw = await pickBackupFile();
      if (!raw) return;
      const backup = parseBackup(raw);
      await applyBackup(
        backup,
        'To zastąpi sezony, miejsca, kalendarz i dojazdy danymi z pliku. Tego nie cofniesz, chyba że masz inną kopię.'
      );
    } catch (error) {
      Alert.alert('Nie udało się odczytać pliku', error instanceof Error ? error.message : 'Wybierz plik JSON z Ewidencji.');
    }
  }

  async function restoreDeviceCopy() {
    try {
      const backup = await loadDeviceCopy();
      if (!backup) {
        Alert.alert('Brak kopii', 'Nie ma jeszcze automatycznej kopii na tym urządzeniu.');
        return;
      }
      await applyBackup(
        backup,
        `Przywrócę kopię z ${new Date(backup.exportedAt).toLocaleString('pl-PL')}. Bieżące dane zostaną zastąpione.`
      );
    } catch (error) {
      Alert.alert('Nie udało się przywrócić', error instanceof Error ? error.message : 'Spróbuj ponownie.');
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <PwaInstallHint />
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

        <Card>
          <Text style={styles.section}>Kopia zapasowa</Text>
          <Text style={styles.helpTop}>
            Zapis do pliku (JSON) możesz wrzucić na iCloud, Dysk Google albo wysłać sobie mailem. Na
            urządzeniu trzymana jest też automatyczna kopia na wypadek awarii.
          </Text>
          <SettingRow
            label="Kopia na urządzeniu"
            value={
              deviceCopy
                ? `${new Date(deviceCopy.exportedAt).toLocaleString('pl-PL')} · ${deviceCopy.events} wyd.`
                : 'Brak'
            }
          />
          <AppButton
            label={busy ? 'Chwileczkę…' : 'Zapisz do pliku'}
            onPress={() => void exportToFile()}
            disabled={busy}
          />
          <AppButton
            label="Wczytaj z pliku"
            variant="secondary"
            onPress={() => void importFromFile()}
            disabled={busy}
          />
          <AppButton
            label="Przywróć kopię z urządzenia"
            variant="ghost"
            onPress={() => void restoreDeviceCopy()}
            disabled={busy || !deviceCopy}
          />
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
