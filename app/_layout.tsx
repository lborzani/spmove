import React, { useEffect, useState } from 'react';
import { setupNotificationHandler, setupAndroidChannel, requestNotificationPermissions } from '@/services/notifications';
import { registerBackgroundTask } from '@/services/backgroundTask';
import { View } from 'react-native';
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
import { theme } from '@/constants/theme';

SplashScreen.preventAutoHideAsync();

const ONBOARDED_KEY = 'linha_onboarded';

// Configuração do QueryClient:
// - status: polling a cada 5min (interval da API)
// - ocorrencias: stale 5min, não refetch em background por causa do rate limit 1/5min
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30_000),
      staleTime: 5 * 60 * 1000,       // 5 min
      gcTime:    10 * 60 * 1000,      // 10 min no cache
    },
  },
});

function AppNavigator() {
  const [ready, setReady] = useState(false);
  const [fontsLoaded] = useFonts({
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  });

  useEffect(() => {
    setupNotificationHandler();
    setupAndroidChannel();
    registerBackgroundTask();
    requestNotificationPermissions();
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

  if (!ready) return <View style={{ flex: 1, backgroundColor: theme.bg }} />;

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.bg },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="onboarding" options={{ animation: 'none' }} />
        <Stack.Screen name="(tabs)"     options={{ animation: 'none' }} />
        <Stack.Screen name="line/[id]" />
        <Stack.Screen name="settings"  options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AppNavigator />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
