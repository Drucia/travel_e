import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';

import { TextField } from '@/components/fields';
import { AppButton, ChoiceGroup, Screen, Title } from '@/components/ui';
import { colors, space } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { cloudErrorMessage } from '@/lib/cloud/errors';

export default function LoginScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!email.trim() || !password) {
      Alert.alert('Uzupełnij dane', 'Podaj e-mail i hasło.');
      return;
    }
    setSaving(true);
    try {
      if (mode === 'login') {
        await signIn(email, password);
        return;
      }
      const result = await signUp(email, password, displayName);
      if (result === 'confirm') {
        Alert.alert(
          'Sprawdź e-mail',
          'Konto utworzone. Potwierdź adres albo w panelu Supabase (Authentication → Providers → Email) wyłącz „Confirm email”.'
        );
      }
    } catch (error) {
      Alert.alert('Nie udało się', cloudErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Title>Ewidencja</Title>
          <Text style={styles.lead}>
            Zaloguj się, żeby współdzielić sezony, miejsca i kalendarz z grupą dojazdową. Każda osoba
            uzupełnia swój dojazd osobno.
          </Text>

          <ChoiceGroup
            options={[
              { label: 'Logowanie', value: 'login' },
              { label: 'Rejestracja', value: 'register' },
            ]}
            value={mode}
            onChange={setMode}
          />

          {mode === 'register' ? (
            <TextField
              label="Imię (opcjonalnie)"
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="np. Ania"
              autoCapitalize="words"
            />
          ) : null}

          <TextField
            label="E-mail"
            value={email}
            onChangeText={setEmail}
            placeholder="ty@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
          />
          <TextField
            label="Hasło"
            value={password}
            onChangeText={setPassword}
            placeholder="min. 6 znaków"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="password"
          />

          <AppButton
            label={saving ? 'Chwileczkę…' : mode === 'login' ? 'Zaloguj się' : 'Utwórz konto'}
            onPress={() => void submit()}
            disabled={saving}
          />
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
    paddingTop: 48,
    paddingBottom: 40,
  },
  lead: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 22,
  },
});
