import { Stack } from 'expo-router';

import { colors } from '@/constants/theme';

export default function EventLayout() {
  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: colors.background },
      }}>
      <Stack.Screen name="form" options={{ title: 'Wydarzenie' }} />
      <Stack.Screen name="[id]" options={{ title: 'Wydarzenie' }} />
    </Stack>
  );
}
