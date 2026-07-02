import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { sendPasswordResetEmail } from 'firebase/auth';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { auth } from '@/config/firebase';
import { Brand } from '@/constants/brand';

export default function RecuperarScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviarEnlace() {
    setError(null);
    const correo = email.trim();
    if (!correo || !correo.includes('@')) {
      setError('Ingresá un correo válido.');
      return;
    }
    setEnviando(true);
    try {
      // Firebase envía un correo real con un enlace para restablecer la contraseña.
      await sendPasswordResetEmail(auth, correo);
      setEnviado(true);
    } catch (e: any) {
      setError(
        e.code === 'auth/invalid-email' ? 'Correo inválido.' :
        e.code === 'auth/user-not-found' ? 'No existe una cuenta con ese correo.' :
        e.code === 'auth/too-many-requests' ? 'Demasiados intentos. Esperá un momento.' :
        'No se pudo enviar el enlace. Revisá tu conexión e intentá de nuevo.'
      );
    } finally {
      setEnviando(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      {/* Decoración */}
      <View style={styles.decoVerde} />
      <View style={styles.decoRojo} />

      {/* Back */}
      <Pressable onPress={() => router.back()} style={[styles.backBtn, { top: insets.top + 8 }]}>
        <Ionicons name="arrow-back" size={22} color={Brand.onLight} />
      </Pressable>

      {enviado ? (
        /* ===== Confirmación ===== */
        <View style={styles.contenido}>
          <View style={[styles.badge, { backgroundColor: Brand.success + '18' }]}>
            <View style={[styles.badgeInner, { borderColor: Brand.success + '55' }]}>
              <Ionicons name="mail-open" size={36} color={Brand.success} />
            </View>
          </View>

          <Text style={styles.titulo}>Revisá tu correo</Text>
          <Text style={styles.subtitulo}>
            Te enviamos un enlace a{' '}
            <Text style={styles.emailFuerte}>{email.trim()}</Text>{' '}
            para que pongas una nueva contraseña. Si no lo ves, revisá la carpeta de spam.
          </Text>

          <Pressable
            style={({ pressed }) => [styles.btnRojo, pressed && { opacity: 0.9 }]}
            onPress={() => router.replace('/login')}>
            <Text style={styles.btnRojoText}>Volver a iniciar sesión</Text>
          </Pressable>

          <Pressable onPress={() => { setEnviado(false); }} style={styles.volver}>
            <Text style={styles.volverText}>Reenviar a otro correo</Text>
          </Pressable>
        </View>
      ) : (
        /* ===== Formulario ===== */
        <View style={styles.contenido}>
          {/* Badge candado */}
          <View style={styles.badge}>
            <View style={styles.badgeInner}>
              <Ionicons name="lock-closed" size={38} color={Brand.primary} />
            </View>
          </View>

          <Text style={styles.titulo}>¿Olvidaste tu{'\n'}contraseña?</Text>
          <Text style={styles.subtitulo}>
            Ingresá tu correo y te enviaremos un enlace para restablecer tu contraseña.
          </Text>

          <View style={styles.campo}>
            <Text style={styles.label}>Correo electrónico</Text>
            <TextInput
              style={styles.input}
              placeholder="ejemplo@correo.com"
              placeholderTextColor={Brand.onLightMuted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              returnKeyType="send"
              onSubmitEditing={enviarEnlace}
            />
          </View>

          {error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={15} color={Brand.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Pressable
            style={({ pressed }) => [styles.btnRojo, pressed && { opacity: 0.9 }]}
            onPress={enviarEnlace}
            disabled={enviando}>
            {enviando
              ? <ActivityIndicator color={Brand.white} />
              : <Text style={styles.btnRojoText}>Enviar enlace</Text>}
          </Pressable>

          <Pressable onPress={() => router.replace('/login')} style={styles.volver}>
            <Text style={styles.volverText}>← Volver a iniciar sesión</Text>
          </Pressable>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.cream },
  decoVerde: {
    position: 'absolute', width: 200, height: 200, borderRadius: 100,
    backgroundColor: Brand.primary + '14', top: -50, right: -60,
  },
  decoRojo: {
    position: 'absolute', width: 200, height: 200, borderRadius: 100,
    backgroundColor: Brand.red + '10', bottom: -40, left: -50,
  },
  backBtn: {
    position: 'absolute', left: 20,
    width: 40, height: 40, borderRadius: 12, backgroundColor: Brand.white,
    alignItems: 'center', justifyContent: 'center', zIndex: 2,
    shadowColor: Brand.onLight, shadowOpacity: 0.08, shadowRadius: 6, elevation: 2,
  },
  contenido: { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
  badge: {
    width: 110, height: 110, borderRadius: 55, alignSelf: 'center',
    backgroundColor: Brand.primary + '12', alignItems: 'center', justifyContent: 'center',
    marginBottom: 24,
  },
  badgeInner: {
    width: 82, height: 82, borderRadius: 41,
    backgroundColor: Brand.cream, borderWidth: 2, borderColor: Brand.primary + '40',
    alignItems: 'center', justifyContent: 'center',
  },
  titulo: { fontSize: 28, fontWeight: '800', color: Brand.onLight, lineHeight: 34 },
  subtitulo: { fontSize: 14, color: Brand.onLightMuted, lineHeight: 20, marginTop: 8 },
  emailFuerte: { color: Brand.onLight, fontWeight: '700' },
  campo: { gap: 8, marginTop: 24 },
  label: { fontSize: 13, fontWeight: '700', color: Brand.onLight },
  input: {
    backgroundColor: Brand.white, borderWidth: 1.5, borderColor: '#E7E8EE',
    borderRadius: 14, paddingHorizontal: 14, height: 52, fontSize: 15, color: Brand.onLight,
  },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 12,
    backgroundColor: Brand.red + '14', borderColor: Brand.red + '40', borderWidth: 1,
    borderRadius: 10, padding: 10,
  },
  errorText: { color: Brand.danger, fontSize: 13, flex: 1 },
  btnRojo: {
    backgroundColor: Brand.red, borderRadius: 16, height: 54,
    alignItems: 'center', justifyContent: 'center', marginTop: 20,
    shadowColor: Brand.red, shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 6,
  },
  btnRojoText: { color: Brand.white, fontSize: 16, fontWeight: '700' },
  volver: { alignItems: 'center', marginTop: 18 },
  volverText: { fontSize: 14, color: Brand.primary, fontWeight: '600' },
});
