import { Ionicons } from '@expo/vector-icons';
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth';
import { useState } from 'react';
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

type Modo = 'login' | 'registro';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const [modo, setModo] = useState<Modo>('login');
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verPass, setVerPass] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  async function entrarConGoogle() {
    setError(null);
    setCargando(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
    } catch (e: any) {
      if (e.code !== 'auth/popup-closed-by-user') {
        setError(mensajeError(e.code ?? ''));
      }
    } finally {
      setCargando(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>

        {/* Logo */}
        <View style={styles.logoWrap}>
          <View style={styles.logoBadge}>
            <Ionicons name="ticket" size={36} color={Brand.primaryDark} />
          </View>
          <Text style={styles.appName}>{AppInfo.name}</Text>
          <Text style={styles.region}>{AppInfo.region}</Text>
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
                Registrarse
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

          {/* Error */}
          {error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={15} color={Brand.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Botón principal */}
          <Pressable
            style={({ pressed }) => [styles.mainBtn, pressed && { opacity: 0.88 }]}
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
            <Text style={styles.dividerText}>o</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Botón Google */}
          <Pressable
            style={({ pressed }) => [styles.googleBtn, pressed && { opacity: 0.88 }]}
            onPress={entrarConGoogle}
            disabled={cargando}>
            <Ionicons name="logo-google" size={18} color="#EA4335" />
            <Text style={styles.googleText}>Continuar con Google</Text>
          </Pressable>

        </View>

        <Text style={styles.footer}>Corredores · Golfito · Zona Sur 🇨🇷</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Brand.primaryDeep,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 22,
    alignItems: 'center',
  },
  logoWrap: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logoBadge: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: Brand.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  appName: {
    color: Brand.onDark,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  region: {
    color: Brand.onDarkMuted,
    fontSize: 13,
    marginTop: 4,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: Brand.white,
    borderRadius: 22,
    padding: 22,
    gap: 14,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  toggle: {
    flexDirection: 'row',
    backgroundColor: '#F0F0F0',
    borderRadius: 12,
    padding: 3,
    marginBottom: 4,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: 10,
  },
  toggleActive: {
    backgroundColor: Brand.white,
    shadowColor: '#000',
    shadowOpacity: 0.08,
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
    color: Brand.primaryDark,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F7F7',
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#E2E8E7',
    paddingHorizontal: 13,
    height: 50,
  },
  inputIcon: {
    marginRight: 9,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: Brand.onLight,
  },
  eyeBtn: {
    paddingLeft: 8,
    paddingVertical: 4,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(229,72,77,0.08)',
    borderColor: 'rgba(229,72,77,0.25)',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
  },
  errorText: {
    color: Brand.danger,
    fontSize: 13,
    flex: 1,
  },
  mainBtn: {
    backgroundColor: Brand.primary,
    borderRadius: 14,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainBtnText: {
    color: Brand.white,
    fontSize: 16,
    fontWeight: '700',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8E7',
  },
  dividerText: {
    color: Brand.onLightMuted,
    fontSize: 13,
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Brand.white,
    borderWidth: 1.5,
    borderColor: '#E2E8E7',
    borderRadius: 14,
    height: 50,
  },
  googleText: {
    color: Brand.onLight,
    fontSize: 15,
    fontWeight: '600',
  },
  footer: {
    color: Brand.onDarkMuted,
    fontSize: 12,
    marginTop: 28,
  },
});
