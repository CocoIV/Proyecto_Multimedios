import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import 'react-native-reanimated';

// Importamos la función de configuración desde tu nueva clase centralizada
import { configurarPermisosNotificaciones } from '@/utils/notificaciones';

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
  const { user, perfil, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const rutasPublicas = ['login', 'recuperar', 'verificar'];
    const enPublica = rutasPublicas.includes(segments[0]);
    const enLogin = segments[0] === 'login';
    const enOnboarding = segments[0] === 'onboarding';

    if (!user) {
      if (!enPublica) router.replace('/login');
      return;
    }

    // Con sesión: si el perfil aún no completó el onboarding, lo mandamos ahí.
    const necesitaOnboarding = perfil ? perfil.onboarding_completo !== true : false;

    if (necesitaOnboarding && !enOnboarding) {
      router.replace('/onboarding');
    } else if (!necesitaOnboarding && (enLogin || enOnboarding)) {
      router.replace('/(tabs)');
    }
  }, [user, perfil, loading, segments, router]);
}

function RootNavigator() {
  const colorScheme = useColorScheme();
  const { loading, user } = useAuth();
  useProtectedRoute();

  // Llamamos a la configuración centralizada al iniciar sesión
  useEffect(() => {
    if (user) {
      configurarPermisosNotificaciones();
    }
  }, [user]);

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
        <Stack.Screen name="recuperar" options={{ headerShown: false }} />
        <Stack.Screen name="verificar" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="crear-rifa" options={{ headerShown: false }} />
        <Stack.Screen name="mis-rifas" options={{ headerShown: false }} />
        <Stack.Screen name="rifa/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="admin-rifa/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="boleto/[rifa]/[numero]" options={{ headerShown: false }} />
        <Stack.Screen name="ganador/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="premio/[id]" options={{ headerShown: false }} />
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