import { Stack } from 'expo-router';

import { colors } from '@/constants/theme';

export default function SeasonLayout() {
  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: colors.background },
      }}>
      <Stack.Screen name="new" options={{ title: 'Nowy sezon' }} />
      <Stack.Screen name="[id]" options={{ title: 'Sezon' }} />
    </Stack>
  );
}
