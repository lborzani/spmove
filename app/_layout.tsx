import { useEffect, useState } from 'react';
import {
  setupNotificationHandler,
  setupAndroidChannel,
  requestNotificationPermissions,
} from '@/services/notifications';
import { getGlobalEnabled } from '@/constants/notifPrefs';
import { registerWithBackend } from '@/services/pushRegistration';
import { getFavorites } from '@/constants/favPrefs';
import { configureAndroidWidget } from '@/services/widgetSync';
import { View, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  useFonts,
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { ONBOARDED_KEY } from '@/constants/storage';
import { SubscriptionProvider } from '@/context/SubscriptionContext';
import { RuntimeThemeProvider, useRuntimeTheme } from '@/context/RuntimeThemeContext';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30_000),
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
    },
  },
});

function AppNavigator() {
  const { rt } = useRuntimeTheme();
  const [ready, setReady] = useState(false);
  const [fontsLoaded] = useFonts({
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  });

  useEffect(() => {
    if (Platform.OS === 'web') {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch(() => null);
      }
      import('@/services/installPrompt.web').then(({ captureInstallPrompt }) => {
        captureInstallPrompt();
      });
      (async () => {
        const granted = await requestNotificationPermissions();
        if (!granted) return;
        const enabled = await getGlobalEnabled();
        if (!enabled) return;
        const favorites = await getFavorites();
        registerWithBackend(favorites).catch(() => null);
      })();
      return;
    }
    setupNotificationHandler();
    setupAndroidChannel();
    if (Platform.OS === 'android') {
      getFavorites().then((favs) => {
        configureAndroidWidget(
          process.env.EXPO_PUBLIC_BACKEND_URL ?? '',
          process.env.EXPO_PUBLIC_BACKEND_KEY ?? '',
          favs,
        );
      });
    }
    (async () => {
      const granted = await requestNotificationPermissions();
      if (!granted) return;
      const enabled = await getGlobalEnabled();
      if (!enabled) return;
      const favorites = await getFavorites();
      registerWithBackend(favorites).catch(() => null);
    })();
  }, []);

  useEffect(() => {
    if (fontsLoaded) setReady(true);
  }, [fontsLoaded]);

  useEffect(() => {
    if (!ready) return;
    (async () => {
      try {
        const done = await AsyncStorage.getItem(ONBOARDED_KEY);
        router.replace(done ? '/(tabs)' : '/onboarding');
      } catch {
        router.replace('/onboarding');
      } finally {
        await SplashScreen.hideAsync();
      }
    })();
  }, [ready]);

  if (!ready) return <View style={{ flex: 1, backgroundColor: rt.bg }} />;

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: rt.bg },
          animation: 'slide_from_right',
        }}>
        <Stack.Screen name="onboarding" options={{ animation: 'none' }} />
        <Stack.Screen name="(tabs)" options={{ animation: 'none' }} />
        <Stack.Screen name="line/[id]" />
        <Stack.Screen
          name="settings"
          options={{ animation: 'slide_from_bottom', presentation: 'modal' }}
        />
        <Stack.Screen
          name="subscription"
          options={{ animation: 'slide_from_bottom', presentation: 'modal' }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <SubscriptionProvider>
            <RuntimeThemeProvider>
              <BottomSheetModalProvider>
                <AppNavigator />
              </BottomSheetModalProvider>
            </RuntimeThemeProvider>
          </SubscriptionProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
