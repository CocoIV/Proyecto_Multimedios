import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import 'react-native-reanimated';

import { Brand } from '@/constants/brand';
import { AuthProvider, useAuth } from '@/context/auth';
import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  anchor: '(tabs)',
};

/**
 * Mantiene al usuario en la pantalla correcta según su sesión:
 * sin sesión -> /login, con sesión -> app (tabs).
 */
function useProtectedRoute() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const enLogin = segments[0] === 'login';

    if (!user && !enLogin) {
      router.replace('/login');
    } else if (user && enLogin) {
      router.replace('/(tabs)');
    }
  }, [user, loading, segments, router]);
}

function RootNavigator() {
  const colorScheme = useColorScheme();
  const { loading } = useAuth();
  useProtectedRoute();

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: Brand.primaryDeep,
        }}>
        <ActivityIndicator size="large" color={Brand.accent} />
      </View>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="crear-rifa" options={{ headerShown: false }} />
        <Stack.Screen name="rifa/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="admin-rifa/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="resultados" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}
