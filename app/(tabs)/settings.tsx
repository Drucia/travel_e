import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { AppButton, Card, Screen, SettingRow } from '@/components/ui';
import { TextField } from '@/components/fields';
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
import {
  ensureTelegramInbox,
  isLikelyBotToken,
  isLikelyChatId,
  sendTelegramTest,
  telegramConfigured,
} from '@/lib/telegram';

export default function SettingsScreen() {
  const db = useDb();
  const { settings, activeSeason, destinations, scheduleRules, refresh } = useApp();
  const router = useRouter();
  const [deviceCopy, setDeviceCopy] = useState<DeviceBackupInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [botToken, setBotToken] = useState(settings.telegramBotToken);
  const [chatId, setChatId] = useState(settings.telegramChatId);
  const [telegramBusy, setTelegramBusy] = useState(false);

  useEffect(() => {
    setBotToken(settings.telegramBotToken);
    setChatId(settings.telegramChatId);
  }, [settings.telegramBotToken, settings.telegramChatId]);

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
      if (Platform.OS === 'web') {
        const ready = telegramConfigured({
          telegramBotToken: botToken,
          telegramChatId: chatId,
        });
        if (!ready) {
          Alert.alert(
            'Połącz Telegram',
            'Na stronie iPhone nie wyśle sam lokalnego powiadomienia. Wpisz token bota i chat ID poniżej, potem wyślij test.'
          );
          return;
        }
      } else {
        const allowed = await ensureNotificationSetup();
        if (!allowed) {
          Alert.alert('Brak zgody', 'Włącz powiadomienia w ustawieniach telefonu, aby otrzymywać przypomnienia.');
          return;
        }
      }
    }
    const next = await updateSettings(db, { reminderEnabled: enabled });
    const incomplete = await listIncompleteEvents(db);
    await rescheduleAllReminders(next, incomplete);
    await refresh();
  }

  async function copyText(value: string) {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(value);
        Alert.alert('Skopiowane', 'Wklej to w GitHubie jako secret REMINDER_BLOB_ID.');
        return;
      }
    } catch {
      // fall through
    }
    Alert.alert('Skopiuj ręcznie', value);
  }

  async function saveTelegram() {
    const token = botToken.trim();
    const id = chatId.trim();
    if (!isLikelyBotToken(token)) {
      Alert.alert('Token', 'To nie wygląda na token z BotFather (liczby, dwukropek, potem ciąg znaków).');
      return;
    }
    if (!isLikelyChatId(id)) {
      Alert.alert('Chat ID', 'Chat ID to liczba z @userinfobot, na przykład 123456789.');
      return;
    }
    setTelegramBusy(true);
    try {
      await sendTelegramTest(token, id);
      let blobId = settings.telegramBlobId;
      try {
        blobId = await ensureTelegramInbox({
          ...settings,
          telegramBotToken: token,
          telegramChatId: id,
        });
      } catch (inboxError) {
        console.warn('Nie udało się zapisać skrzynki przypomnień', inboxError);
      }
      const next = await updateSettings(db, {
        reminderEnabled: true,
        telegramBotToken: token,
        telegramChatId: id,
        telegramBlobId: blobId,
      });
      const incomplete = await listIncompleteEvents(db);
      await rescheduleAllReminders(next, incomplete);
      await refresh();
      Alert.alert(
        'Telegram działa',
        blobId
          ? Platform.OS === 'web'
            ? 'Testowa wiadomość poszła. Żeby przypomnienie przyszło przy zablokowanym telefonie, dodaj w GitHubie secret REMINDER_BLOB_ID (przycisk poniżej).'
            : 'Testowa wiadomość poszła. Na tym telefonie zostają też lokalne powiadomienia.'
          : 'Testowa wiadomość poszła. Przypomnienie dojdzie, gdy apka jest otwarta. Skrzynka do wysyłki w tle nie wstała — spróbuj ponownie za chwilę.'
      );
    } catch (error) {
      Alert.alert('Nie połączono', error instanceof Error ? error.message : 'Sprawdź token, chat ID i czy bot dostał Start.');
    } finally {
      setTelegramBusy(false);
    }
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
          {destinations.length === 0 ? (
            <View style={styles.emptyPlace}>
              <Text style={styles.empty}>Nie masz jeszcze miejsc. Dodaj je, zanim ustawisz stałe dni.</Text>
              <AppButton
                label="Dodaj miejsce"
                variant="secondary"
                onPress={() => router.push('/destinations/new')}
              />
            </View>
          ) : null}
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
                    {rule.notes ? <Text style={styles.ruleNote}>{rule.notes}</Text> : null}
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
            {Platform.OS === 'web'
              ? 'W PWA na iPhonie przypomnienie przychodzi na Telegram, zaraz po końcu treningu lub meczu. Link w wiadomości otworzy formularz dojazdu.'
              : 'Powiadomienie przyjdzie zaraz po godzinie zakończenia treningu lub meczu i otworzy formularz dojazdu. Na stronie możesz dostać to samo na Telegram.'}
          </Text>

          <Text style={styles.subSection}>Telegram</Text>
          <Text style={styles.helpTop}>
            1. W Telegramie otwórz{' '}
            <Text style={styles.link} onPress={() => void Linking.openURL('https://t.me/BotFather')}>
              @BotFather
            </Text>
            {' '}→ /newbot → skopiuj token.{'\n'}
            2. Wejdź do swojego bota i naciśnij Start.{'\n'}
            3. Otwórz{' '}
            <Text style={styles.link} onPress={() => void Linking.openURL('https://t.me/userinfobot')}>
              @userinfobot
            </Text>
            {' '}i skopiuj Id.
          </Text>
          <View style={styles.telegramFields}>
            <TextField
              label="Token bota"
              value={botToken}
              onChangeText={setBotToken}
              placeholder="123456:ABC..."
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
              secureTextEntry
            />
            <TextField
              label="Chat ID"
              value={chatId}
              onChangeText={setChatId}
              placeholder="123456789"
              keyboardType="numeric"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
            />
            <AppButton
              label={telegramBusy ? 'Łączę…' : 'Wyślij test na Telegram'}
              onPress={() => void saveTelegram()}
              disabled={telegramBusy}
            />
            {settings.telegramBlobId ? (
              <View style={styles.blobBox}>
                <Text style={styles.helpTop}>
                  Ostatni krok, żeby działało przy zablokowanym telefonie: GitHub → Settings → Secrets and
                  variables → Actions → New repository secret. Nazwa: REMINDER_BLOB_ID. Wartość poniżej.
                  Nie wysyłaj tego nikomu.
                </Text>
                <Text selectable style={styles.blobId}>
                  {settings.telegramBlobId}
                </Text>
                <AppButton
                  label="Kopiuj REMINDER_BLOB_ID"
                  variant="secondary"
                  onPress={() => void copyText(settings.telegramBlobId)}
                />
                <AppButton
                  label="Otwórz sekrety GitHub"
                  variant="ghost"
                  onPress={() =>
                    void Linking.openURL('https://github.com/Drucia/travel_e/settings/secrets/actions')
                  }
                />
              </View>
            ) : null}
          </View>
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
          <View style={styles.backupActions}>
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
          </View>
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
  subSection: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    marginTop: 18,
    marginBottom: 8,
  },
  link: {
    color: colors.text,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  telegramFields: {
    gap: 12,
  },
  blobBox: {
    gap: 10,
  },
  blobId: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: 12,
  },
  empty: {
    color: colors.muted,
    marginBottom: 12,
  },
  emptyPlace: {
    gap: 8,
    marginBottom: 12,
  },
  backupActions: {
    gap: 10,
    marginTop: 8,
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
  ruleNote: {
    color: colors.text,
    fontSize: 13,
    marginTop: 6,
  },
});
