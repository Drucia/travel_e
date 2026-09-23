import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text } from 'react-native';

import { Card } from '@/components/ui';
import { colors } from '@/constants/theme';
import { isIosDevice, isStandaloneDisplay } from '@/lib/pwa';

export function PwaInstallHint() {
  const [visible, setVisible] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    setIos(isIosDevice());
    setVisible(!isStandaloneDisplay());
  }, []);

  if (!visible) return null;

  return (
    <Card>
      <Text style={styles.title}>Ikona na pulpicie</Text>
      {ios ? (
        <Text style={styles.body}>
          W Safari stuknij Udostępnij (kwadrat ze strzałką), potem „Dodaj do ekranu początkowego”.
          Ewidencja otworzy się jak aplikacja, bez paska przeglądarki.
        </Text>
      ) : (
        <Text style={styles.body}>
          W Chrome lub Edge kliknij ikonę instalacji w pasku adresu albo Menu → „Zainstaluj
          Ewidencję” / „Zainstaluj aplikację”. Pojawi się ikona na pulpicie.
        </Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  body: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
});
