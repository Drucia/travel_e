import { type Href, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import { AppButton, Card, Screen } from '@/components/ui';
import { colors, space } from '@/constants/theme';
import { useApp, useDb } from '@/context/AppContext';
import { confirmAction } from '@/lib/confirm';
import { cloudErrorMessage } from '@/lib/cloud/errors';
import { inviteMessage } from '@/lib/cloud/join';
import { deleteGroup, leaveGroup, listMembers, listMyGroups, removeMember } from '@/lib/cloud/queries';
import { setActiveGroupId } from '@/lib/db/queries';
import type { GroupMember } from '@/lib/db/types';

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { groups, group, userId, refresh, selectGroup } = useApp();
  const db = useDb();
  const router = useRouter();
  const [people, setPeople] = useState<GroupMember[]>([]);

  const current = useMemo(
    () => groups.find((item) => item.id === id) ?? (group?.id === id ? group : null),
    [groups, group, id]
  );
  const isOwner = current?.role === 'owner';

  const loadMembers = useCallback(async () => {
    if (!id) return;
    try {
      setPeople(await listMembers(id));
    } catch (error) {
      Alert.alert('Nie udało się wczytać członkiń', cloudErrorMessage(error));
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void loadMembers();
    }, [loadMembers])
  );

  async function shareCode() {
    if (!current) return;
    await Share.share({ message: inviteMessage(current.name, current.joinCode) });
  }

  async function onLeave() {
    if (!id || !userId || !current) return;
    if (isOwner) {
      Alert.alert('Właścicielka', 'Aby opuścić grupę, usuń ją. Kod przestanie działać dla wszystkich.');
      return;
    }
    const ok = await confirmAction('Opuścić grupę?', 'Twoje uzupełnione dojazdy zostaną w chmurze.', 'Opuść');
    if (!ok) return;
    try {
      await leaveGroup(id, userId);
      const remaining = (await listMyGroups()).filter((item) => item.id !== id);
      await setActiveGroupId(db, remaining[0]?.id ?? null);
      await refresh();
      router.replace('/groups' as Href);
    } catch (error) {
      Alert.alert('Nie udało się', cloudErrorMessage(error));
    }
  }

  async function onDelete() {
    if (!id) return;
    const ok = await confirmAction(
      'Usunąć grupę?',
      'Znikną wspólny kalendarz, miejsca i odpowiedzi wszystkich członkiń.'
    );
    if (!ok) return;
    try {
      await deleteGroup(id);
      const remaining = await listMyGroups();
      await setActiveGroupId(db, remaining[0]?.id ?? null);
      await refresh();
      router.replace('/groups' as Href);
    } catch (error) {
      Alert.alert('Nie udało się', cloudErrorMessage(error));
    }
  }

  async function onRemove(memberId: string, name: string) {
    if (!id) return;
    const ok = await confirmAction(`Usunąć ${name}?`, 'Osoba straci dostęp do grupy.');
    if (!ok) return;
    try {
      await removeMember(id, memberId);
      await loadMembers();
      await refresh();
    } catch (error) {
      Alert.alert('Nie udało się', cloudErrorMessage(error));
    }
  }

  if (!current) {
    return (
      <Screen>
        <Text style={styles.missing}>Nie znaleziono grupy.</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Card>
          <Text style={styles.name}>{current.name}</Text>
          <Text style={styles.code}>{current.joinCode}</Text>
          <Text style={styles.meta}>Podaj ten kod osobom z grupy dojazdowej.</Text>
        </Card>

        <AppButton label="Udostępnij kod" onPress={() => void shareCode()} />
        {group?.id !== current.id ? (
          <AppButton
            label="Używaj tej grupy"
            variant="secondary"
            onPress={() => void selectGroup(current.id)}
          />
        ) : null}

        <Card>
          <Text style={styles.section}>Członkinie</Text>
          <View style={styles.list}>
            {people.map((member) => (
              <View key={member.userId} style={styles.member}>
                <View style={styles.memberBody}>
                  <Text style={styles.memberName}>
                    {member.displayName}
                    {member.userId === userId ? ' · Ty' : ''}
                  </Text>
                  <Text style={styles.memberMeta}>
                    {member.role === 'owner' ? 'Właścicielka' : 'Członkini'}
                    {member.email ? ` · ${member.email}` : ''}
                  </Text>
                </View>
                {isOwner && member.userId !== userId && member.role !== 'owner' ? (
                  <Pressable onPress={() => void onRemove(member.userId, member.displayName)}>
                    <Text style={styles.delete}>Usuń</Text>
                  </Pressable>
                ) : null}
              </View>
            ))}
          </View>
        </Card>

        {isOwner ? (
          <AppButton label="Usuń grupę" variant="danger" onPress={() => void onDelete()} />
        ) : (
          <AppButton label="Opuść grupę" variant="danger" onPress={() => void onLeave()} />
        )}
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
  name: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '800',
  },
  code: {
    marginTop: 10,
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 3,
  },
  meta: {
    marginTop: 6,
    color: colors.muted,
    fontSize: 14,
  },
  section: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  list: {
    gap: 12,
  },
  member: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  memberBody: {
    flex: 1,
  },
  memberName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  memberMeta: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 2,
  },
  delete: {
    color: colors.danger,
    fontWeight: '700',
  },
  missing: {
    padding: space.lg,
    color: colors.muted,
  },
});
