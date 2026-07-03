import { Ionicons } from '@expo/vector-icons';
import * as Google from 'expo-auth-session/providers/google';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithCredential,
  signInWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { auth } from '@/config/firebase';
import { AppInfo, Brand } from '@/constants/brand';
import { GOOGLE } from '@/constants/google';

WebBrowser.maybeCompleteAuthSession();

type Modo = 'login' | 'registro';

/** Ilustración de tómbola al estilo Tombolitas CR (esfera + bolas + soporte). */
function Tombola() {
  return (
    <View style={styles.tombolaWrap}>
      <View style={styles.esfera}>
        {/* Meridianos */}
        <View style={styles.meridianoV} />
        <View style={styles.meridianoH} />
        {/* Bolas de colores */}
        <View style={[styles.bola, styles.bolaAmbar]}><Text style={styles.bolaText}>7</Text></View>
        <View style={[styles.bola, styles.bolaRojo]}><Text style={styles.bolaText}>23</Text></View>
        <View style={[styles.bola, styles.bolaNavy]}><Text style={styles.bolaText}>5</Text></View>
      </View>
      {/* Soporte */}
      <View style={styles.cuello} />
      <View style={styles.soporte} />
      <View style={styles.pie} />
    </View>
  );
}

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [modo, setModo] = useState<Modo>('login');
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verPass, setVerPass] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [googleRequest, googleResponse, googlePromptAsync] = Google.useAuthRequest({
    webClientId: GOOGLE.webClientId,
    androidClientId: GOOGLE.androidClientId || undefined,
    iosClientId: GOOGLE.iosClientId || undefined,
  });

  useEffect(() => {
    if (!googleResponse) return;

    if (googleResponse.type === 'success') {
      const idToken = googleResponse.params?.id_token;
      if (!idToken) {
        setError('Google no devolvió las credenciales. Intentá de nuevo.');
        return;
      }
      const credential = GoogleAuthProvider.credential(idToken);
      setCargando(true);
      signInWithCredential(auth, credential)
        .catch((e: any) => setError(mensajeError(e.code ?? '')))
        .finally(() => setCargando(false));
    } else if (googleResponse.type === 'error') {
      setError('No se pudo iniciar sesión con Google. Intentá de nuevo.');
    }
    // type === 'dismiss' / 'cancel' → el usuario cerró el flujo, no mostramos error.
  }, [googleResponse]);

  function limpiar() {
    setError(null);
    setNombre('');
    setEmail('');
    setPassword('');
  }

  function cambiarModo(m: Modo) {
    limpiar();
    setModo(m);
  }

  function mensajeError(code: string) {
    switch (code) {
      case 'auth/invalid-email': return 'Correo inválido.';
      case 'auth/user-not-found': return 'No existe una cuenta con ese correo.';
      case 'auth/wrong-password': return 'Contraseña incorrecta.';
      case 'auth/email-already-in-use': return 'Ese correo ya está registrado.';
      case 'auth/weak-password': return 'La contraseña debe tener al menos 6 caracteres.';
      case 'auth/too-many-requests': return 'Demasiados intentos. Esperá un momento.';
      case 'auth/invalid-credential': return 'Correo o contraseña incorrectos.';
      default: return 'Ocurrió un error. Intentá de nuevo.';
    }
  }

  async function entrarConEmail() {
    setError(null);
    if (!email.trim() || !password.trim()) {
      setError('Completá todos los campos.');
      return;
    }
    if (modo === 'registro' && !nombre.trim()) {
      setError('Escribí tu nombre.');
      return;
    }
    setCargando(true);
    try {
      if (modo === 'login') {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      } else {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await updateProfile(cred.user, { displayName: nombre.trim() });
        // El AuthProvider detecta el cambio y crea el doc en Firestore.
      }
    } catch (e: any) {
      setError(mensajeError(e.code ?? ''));
    } finally {
      setCargando(false);
    }
  }

  function entrarConGoogle() {
    setError(null);
    if (!googleRequest) {
      setError('El acceso con Google no está disponible en este dispositivo.');
      return;
    }
    googlePromptAsync();
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      {/* Círculos decorativos */}
      <View style={styles.decoVerdeGrande} />
      <View style={styles.decoAmbar} />

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>

        {/* Encabezado con tómbola */}
        <View style={styles.header}>
          <Tombola />
          <View style={styles.badgeTicket}>
            <Text style={styles.badgeTicketText}>🎟 TÓMBOLA</Text>
          </View>
          <Text style={styles.appName}>{AppInfo.name}</Text>
          <View style={styles.subrayado} />
          <Text style={styles.tagline}>{AppInfo.tagline}</Text>
        </View>

        {/* Tarjeta de formulario */}
        <View style={styles.card}>

          {/* Selector Login / Registro */}
          <View style={styles.toggle}>
            <Pressable
              style={[styles.toggleBtn, modo === 'login' && styles.toggleActive]}
              onPress={() => cambiarModo('login')}>
              <Text style={[styles.toggleText, modo === 'login' && styles.toggleTextActive]}>
                Iniciar sesión
              </Text>
            </Pressable>
            <Pressable
              style={[styles.toggleBtn, modo === 'registro' && styles.toggleActive]}
              onPress={() => cambiarModo('registro')}>
              <Text style={[styles.toggleText, modo === 'registro' && styles.toggleTextActive]}>
                Crear cuenta
              </Text>
            </Pressable>
          </View>

          {/* Nombre (solo registro) */}
          {modo === 'registro' && (
            <View style={styles.inputWrap}>
              <Ionicons name="person-outline" size={18} color={Brand.onLightMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Nombre completo"
                placeholderTextColor={Brand.onLightMuted}
                value={nombre}
                onChangeText={setNombre}
                autoCapitalize="words"
                returnKeyType="next"
              />
            </View>
          )}

          {/* Correo */}
          <View style={styles.inputWrap}>
            <Ionicons name="mail-outline" size={18} color={Brand.onLightMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Correo electrónico"
              placeholderTextColor={Brand.onLightMuted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              returnKeyType="next"
            />
          </View>

          {/* Contraseña */}
          <View style={styles.inputWrap}>
            <Ionicons name="lock-closed-outline" size={18} color={Brand.onLightMuted} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Contraseña"
              placeholderTextColor={Brand.onLightMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!verPass}
              returnKeyType="done"
              onSubmitEditing={entrarConEmail}
            />
            <Pressable onPress={() => setVerPass(v => !v)} style={styles.eyeBtn}>
              <Ionicons
                name={verPass ? 'eye-off-outline' : 'eye-outline'}
                size={18}
                color={Brand.onLightMuted}
              />
            </Pressable>
          </View>

          {modo === 'login' && (
            <Pressable onPress={() => router.push('/recuperar' as any)}>
              <Text style={styles.olvidaste}>¿Olvidaste tu contraseña?</Text>
            </Pressable>
          )}

          {/* Error */}
          {error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={15} color={Brand.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Botón principal (rojo) */}
          <Pressable
            style={({ pressed }) => [styles.mainBtn, pressed && { opacity: 0.9 }]}
            onPress={entrarConEmail}
            disabled={cargando}>
            {cargando
              ? <ActivityIndicator color={Brand.white} />
              : <Text style={styles.mainBtnText}>
                  {modo === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
                </Text>
            }
          </Pressable>

          {/* Separador */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>o continúa con</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Botón Google */}
          <Pressable
            style={({ pressed }) => [styles.googleBtn, pressed && { opacity: 0.9 }]}
            onPress={entrarConGoogle}
            disabled={cargando}>
            <Text style={styles.googleG}>G</Text>
            <Text style={styles.googleText}>Continuar con Google</Text>
          </Pressable>

        </View>

        <Text style={styles.footer}>Rifas locales · Zona Sur 🇨🇷</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Brand.cream,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  decoVerdeGrande: {
    position: 'absolute',
    width: 320, height: 320, borderRadius: 160,
    backgroundColor: Brand.primary + '18',
    top: -160, right: -80,
  },
  decoAmbar: {
    position: 'absolute',
    width: 240, height: 240, borderRadius: 120,
    backgroundColor: Brand.accent + '14',
    bottom: 40, left: -90,
  },

  // --- Tómbola ---
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  tombolaWrap: {
    alignItems: 'center',
    marginBottom: 8,
  },
  esfera: {
    width: 150, height: 150, borderRadius: 75,
    backgroundColor: Brand.white,
    borderWidth: 3, borderColor: Brand.primary,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: Brand.primaryDeep, shadowOpacity: 0.18, shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 }, elevation: 6,
  },
  meridianoV: {
    position: 'absolute',
    width: 74, height: 150, borderRadius: 37,
    borderWidth: 2, borderColor: Brand.primary + '30',
  },
  meridianoH: {
    position: 'absolute',
    width: 150, height: 2,
    backgroundColor: Brand.primary + '30',
  },
  bola: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center',
    position: 'absolute',
  },
  bolaAmbar: { backgroundColor: Brand.accent, top: 30, left: 34 },
  bolaRojo: { backgroundColor: Brand.red, top: 22, right: 30 },
  bolaNavy: { backgroundColor: Brand.onLight, bottom: 26, alignSelf: 'center' },
  bolaText: { color: Brand.white, fontWeight: '800', fontSize: 15 },
  cuello: { width: 22, height: 16, backgroundColor: Brand.primary + '90' },
  soporte: { width: 120, height: 12, borderRadius: 6, backgroundColor: Brand.primary + 'B0' },
  pie: { width: 140, height: 10, borderRadius: 5, backgroundColor: Brand.primary + '99', marginTop: 22 },

  badgeTicket: {
    backgroundColor: Brand.accent + '26',
    borderColor: Brand.accent + '80', borderWidth: 1,
    borderRadius: 20, paddingVertical: 3, paddingHorizontal: 12,
    marginTop: 6,
  },
  badgeTicketText: { color: Brand.accentText, fontSize: 11, fontWeight: '700' },
  appName: {
    color: Brand.onLight,
    fontSize: 40, fontWeight: '800', letterSpacing: 0.2,
    marginTop: 10,
  },
  subrayado: {
    width: 144, height: 5, borderRadius: 3,
    backgroundColor: Brand.red, marginTop: 2,
  },
  tagline: {
    color: Brand.onLightMuted, fontSize: 12, fontWeight: '600',
    letterSpacing: 1, marginTop: 8,
  },

  // --- Tarjeta ---
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: Brand.white,
    borderRadius: 28,
    padding: 22,
    gap: 14,
    shadowColor: Brand.onLight,
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
  toggle: {
    flexDirection: 'row',
    backgroundColor: '#F0F1F4',
    borderRadius: 14,
    padding: 3,
    marginBottom: 2,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 11,
  },
  toggleActive: {
    backgroundColor: Brand.white,
    shadowColor: Brand.onLight,
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: Brand.onLightMuted,
  },
  toggleTextActive: {
    color: Brand.primary,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Brand.inputBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E7E8EE',
    paddingHorizontal: 13,
    height: 52,
  },
  inputIcon: { marginRight: 9 },
  input: {
    flex: 1,
    fontSize: 15,
    color: Brand.onLight,
  },
  eyeBtn: { paddingLeft: 8, paddingVertical: 4 },
  olvidaste: {
    color: Brand.red,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'right',
    marginTop: -4,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: Brand.red + '14',
    borderColor: Brand.red + '40',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
  },
  errorText: { color: Brand.danger, fontSize: 13, flex: 1 },
  mainBtn: {
    backgroundColor: Brand.red,
    borderRadius: 18,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Brand.red,
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  mainBtnText: { color: Brand.white, fontSize: 17, fontWeight: '700' },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: Brand.onLight + '18' },
  dividerText: { color: Brand.onLight + '66', fontSize: 12 },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Brand.inputBg,
    borderWidth: 1,
    borderColor: Brand.onLight + '1A',
    borderRadius: 18,
    height: 56,
  },
  googleG: { color: Brand.google, fontSize: 20, fontWeight: '800' },
  googleText: { color: Brand.onLight, fontSize: 16, fontWeight: '600' },
  footer: {
    color: Brand.onLightMuted,
    fontSize: 12,
    marginTop: 24,
  },
});
