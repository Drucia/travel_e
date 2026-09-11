import { ScrollView, StyleSheet, Text } from 'react-native';

import { Card, Screen, Title } from '@/components/ui';
import { colors, space } from '@/constants/theme';

export default function SetupScreen() {
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Title>Ewidencja</Title>
        <Text style={styles.lead}>
          Do współdzielenia dojazdów potrzebny jest darmowy projekt na supabase.com. Aplikacja nie ma
          własnego serwera.
        </Text>

        <Card>
          <Text style={styles.step}>1. Załóż projekt</Text>
          <Text style={styles.body}>
            Wejdź na supabase.com, utwórz konto i nowy projekt (plan Free). Region dowolny.
          </Text>
        </Card>
        <Card>
          <Text style={styles.step}>2. Wklej URL i klucz</Text>
          <Text style={styles.body}>
            Project Settings → API: skopiuj Project URL i klucz publishable (albo anon public). W
            folderze aplikacji skopiuj .env.example do .env i wklej te dwie wartości. Ta aplikacja
            jest na Expo — nie używaj snippetu Next.js z panelu.
          </Text>
        </Card>
        <Card>
          <Text style={styles.step}>3. Uruchom SQL</Text>
          <Text style={styles.body}>
            SQL Editor → wklej plik supabase/schema.sql i kliknij Run. Potem zrestartuj aplikację
            (npm start).
          </Text>
        </Card>
        <Text style={styles.note}>
          Szczegóły są w README. Darmowy projekt może się uśpić po około 7 dniach bez użycia — wtedy
          wystarczy otworzyć panel Supabase, żeby go obudzić.
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
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
  step: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  body: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  note: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
});
