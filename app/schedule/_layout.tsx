import { Stack } from 'expo-router';

import { colors } from '@/constants/theme';

export default function ScheduleLayout() {
  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: colors.background },
      }}>
      <Stack.Screen name="new" options={{ title: 'Harmonogram' }} />
      <Stack.Screen name="[id]" options={{ title: 'Harmonogram' }} />
      <Stack.Screen name="form" options={{ title: 'Harmonogram' }} />
    </Stack>
  );
}
