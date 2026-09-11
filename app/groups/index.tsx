import { type Href, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { TextField } from '@/components/fields';
import { AppButton, Banner, Card, EmptyState, Screen } from '@/components/ui';
import { colors, radius, space } from '@/constants/theme';
import { useApp } from '@/context/AppContext';
import { cloudErrorMessage } from '@/lib/cloud/errors';

export default function GroupsScreen() {
  const { groups, group, cloudError, createGroup, joinGroup, selectGroup } = useApp();
  const router = useRouter();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [saving, setSaving] = useState(false);

  async function onCreate() {
    setSaving(true);
    try {
      await createGroup(name);
      router.replace('/(tabs)');
    } catch (error) {
      Alert.alert('Nie udało się utworzyć grupy', cloudErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function onJoin() {
    setSaving(true);
    try {
      await joinGroup(code);
      router.replace('/(tabs)');
    } catch (error) {
      Alert.alert('Nie udało się dołączyć', cloudErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function onSelect(id: string) {
    await selectGroup(id);
    router.replace('/(tabs)');
  }

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {cloudError ? <Banner text={cloudError} /> : null}
          <Text style={styles.hint}>
            Jedna osoba tworzy grupę dojazdową i przekazuje kod. Reszta dołącza i uzupełnia swoje
            wyjazdy.
          </Text>

          {groups.length === 0 ? (
            <Card>
              <EmptyState title="Nie należysz jeszcze do grupy" hint="Utwórz nową albo dołącz kodem." />
            </Card>
          ) : (
            <View style={styles.list}>
              {groups.map((item) => {
                const selected = item.id === group?.id;
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => void onSelect(item.id)}
                    style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
                    <View style={styles.body}>
                      <Text style={styles.name}>{item.name}</Text>
                      <Text style={styles.meta}>
                        Kod {item.joinCode}
                        {item.role === 'owner' ? ' · właścicielka' : ''}
                      </Text>
                    </View>
                    {selected ? (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>Wybrana</Text>
                      </View>
                    ) : (
                      <Text style={styles.chevron}>›</Text>
                    )}
                  </Pressable>
                );
              })}
            </View>
          )}

          {group ? (
            <AppButton
              label="Szczegóły wybranej grupy"
              variant="secondary"
              onPress={() => router.push(`/groups/${group.id}` as Href)}
            />
          ) : null}

          <Card>
            <Text style={styles.section}>Nowa grupa</Text>
            <TextField label="Nazwa" value={name} onChangeText={setName} placeholder="np. Dojazd Gniechowice" />
            <AppButton
              label={saving ? 'Zapisywanie…' : 'Utwórz grupę'}
              onPress={() => void onCreate()}
              disabled={saving || !name.trim()}
            />
          </Card>

          <Card>
            <Text style={styles.section}>Dołącz kodem</Text>
            <TextField
              label="Kod grupy"
              value={code}
              onChangeText={setCode}
              placeholder="np. K7M2QP"
              autoCapitalize="characters"
              autoCorrect={false}
            />
            <AppButton
              label={saving ? 'Dołączanie…' : 'Dołącz'}
              variant="secondary"
              onPress={() => void onJoin()}
              disabled={saving || code.trim().length < 4}
            />
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
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
  section: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
});
