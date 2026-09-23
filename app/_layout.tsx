import { Stack, useRouter } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { Suspense, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';

import { PhonePreview } from '@/components/PhonePreview';
import { LoadingScreen } from '@/components/ui';
import { colors } from '@/constants/theme';
import { AppProvider, useApp } from '@/context/AppContext';
import { migrateDbIfNeeded } from '@/lib/db/schema';
import { eventIdFromNotificationData } from '@/lib/notifications';
import { registerServiceWorker } from '@/lib/pwa';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

export default function RootLayout() {
  return (
    <SafeAreaProvider>
    <PhonePreview>
      <Suspense fallback={<LoadingScreen />}>
        <SQLiteProvider
          databaseName="ewidencja.db"
          onInit={migrateDbIfNeeded}
          useSuspense
          options={{ useNewConnection: Platform.OS === 'web' }}>
          <AppProvider>
            <SplashGate />
            <PwaGate />
            <NotificationGate />
            <StatusBar style="dark" />
            <Stack
              screenOptions={{
                headerShadowVisible: false,
                headerStyle: { backgroundColor: colors.background },
                headerTintColor: colors.text,
                headerTitleStyle: { fontWeight: '700' },
                contentStyle: { backgroundColor: colors.background },
              }}>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="event" options={{ headerShown: false }} />
              <Stack.Screen name="season" options={{ headerShown: false }} />
              <Stack.Screen name="destinations" options={{ headerShown: false }} />
              <Stack.Screen name="schedule" options={{ headerShown: false }} />
            </Stack>
          </AppProvider>
        </SQLiteProvider>
      </Suspense>
    </PhonePreview>
    </SafeAreaProvider>
  );
}

function SplashGate() {
  const { loaded } = useApp();

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [loaded]);

  return null;
}

function PwaGate() {
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    registerServiceWorker();
  }, []);

  return null;
}

function NotificationGate() {
  const router = useRouter();
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (Platform.OS === 'web') return undefined;

    function openFromResponse(response: Notifications.NotificationResponse | null) {
      const eventId = eventIdFromNotificationData(response?.notification.request.content.data);
      if (!eventId || handled.current === eventId) return;
      handled.current = eventId;
      router.push(`/event/${eventId}`);
    }

    const timeout = setTimeout(() => {
      try {
        openFromResponse(Notifications.getLastNotificationResponse());
      } catch {
        // unsupported
      }
    }, 400);

    let sub: { remove: () => void } | null = null;
    try {
      sub = Notifications.addNotificationResponseReceivedListener((response) => {
        handled.current = null;
        openFromResponse(response);
      });
    } catch {
      // unsupported
    }

    return () => {
      clearTimeout(timeout);
      sub?.remove();
    };
  }, [router]);

  return null;
}
