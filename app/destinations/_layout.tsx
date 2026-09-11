import { Stack } from 'expo-router';

import { colors } from '@/constants/theme';

export default function DestinationsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: colors.background },
      }}>
      <Stack.Screen name="index" options={{ title: 'Miejsca' }} />
      <Stack.Screen name="new" options={{ title: 'Nowe miejsce' }} />
      <Stack.Screen name="[id]" options={{ title: 'Miejsce' }} />
    </Stack>
  );
}
