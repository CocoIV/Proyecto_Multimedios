import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { sendPasswordResetEmail } from 'firebase/auth';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
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

const DURACION = 300; // 5 minutos

function mmss(seg: number) {
  const m = Math.floor(seg / 60);
  const s = seg % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function VerificarScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email?: string }>();

  const [digitos, setDigitos] = useState(['', '', '', '']);
  const [segundos, setSegundos] = useState(DURACION);
  const inputs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    if (segundos <= 0) return;
    const t = setInterval(() => setSegundos(s => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [segundos]);

  function cambiar(i: number, val: string) {
    const d = val.replace(/\D/g, '').slice(-1);
    setDigitos(prev => {
      const next = [...prev];
      next[i] = d;
      return next;
    });
    if (d && i < 3) inputs.current[i + 1]?.focus();
  }

  function retroceso(i: number, key: string) {
    if (key === 'Backspace' && !digitos[i] && i > 0) {
      inputs.current[i - 1]?.focus();
    }
  }

  const completo = digitos.every(d => d !== '');

  function verificar() {
    if (!completo) return;
    const msg = 'Correo verificado. Revisá el enlace que te enviamos para restablecer tu contraseña.';
    if (Platform.OS === 'web') window.alert(msg);
    else Alert.alert('¡Listo!', msg);
    router.replace('/login');
  }

  async function reenviar() {
    setSegundos(DURACION);
    setDigitos(['', '', '', '']);
    inputs.current[0]?.focus();
    if (email) {
      try { await sendPasswordResetEmail(auth, email); } catch { /* silencioso */ }
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.decoAmbar} />

      <Pressable onPress={() => router.back()} style={[styles.backBtn, { top: insets.top + 8 }]}>
        <Ionicons name="arrow-back" size={22} color={Brand.onLight} />
      </Pressable>

      <View style={styles.contenido}>
        {/* Badge sobre amarillo */}
        <View style={styles.badge}>
          <View style={styles.badgeInner}>
            <Ionicons name="mail" size={34} color={Brand.white} />
          </View>
        </View>

        <Text style={styles.titulo}>Verifica tu correo</Text>
        <Text style={styles.subtitulo}>
          Enviamos un código de 4 dígitos a{'\n'}
          <Text style={styles.email}>{email || 'tu correo'}</Text>
        </Text>

        {/* Casillas */}
        <View style={styles.codeRow}>
          {digitos.map((d, i) => (
            <TextInput
              key={i}
              ref={el => { inputs.current[i] = el; }}
              style={[styles.codeBox, d ? styles.codeBoxLleno : null]}
              value={d}
              onChangeText={v => cambiar(i, v)}
              onKeyPress={({ nativeEvent }) => retroceso(i, nativeEvent.key)}
              keyboardType="number-pad"
              maxLength={1}
              textAlign="center"
              autoFocus={i === 0}
            />
          ))}
        </View>

        <Pressable onPress={reenviar} style={styles.reenviarWrap}>
          <Text style={styles.reenviarText}>
            ¿No recibiste el código? <Text style={styles.reenviarLink}>Reenviar</Text>
          </Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.btnVerde, !completo && styles.btnDeshabilitado, pressed && { opacity: 0.9 }]}
          onPress={verificar}
          disabled={!completo}>
          <Text style={styles.btnVerdeText}>Verificar código</Text>
        </Pressable>

        <Text style={styles.expira}>
          {segundos > 0 ? `El código expira en ${mmss(segundos)}` : 'El código expiró. Reenvialo.'}
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.cream },
  decoAmbar: {
    position: 'absolute', width: 200, height: 200, borderRadius: 100,
    backgroundColor: Brand.accent + '14', top: -50, right: -60,
  },
  backBtn: {
    position: 'absolute', left: 20,
    width: 40, height: 40, borderRadius: 12, backgroundColor: Brand.white,
    alignItems: 'center', justifyContent: 'center', zIndex: 2,
    shadowColor: Brand.onLight, shadowOpacity: 0.08, shadowRadius: 6, elevation: 2,
  },
  contenido: { flex: 1, justifyContent: 'center', paddingHorizontal: 28, alignItems: 'center' },
  badge: {
    width: 110, height: 110, borderRadius: 55,
    backgroundColor: Brand.accent + '20', alignItems: 'center', justifyContent: 'center',
    marginBottom: 24,
  },
  badgeInner: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: Brand.accent, alignItems: 'center', justifyContent: 'center',
  },
  titulo: { fontSize: 26, fontWeight: '800', color: Brand.onLight, textAlign: 'center' },
  subtitulo: { fontSize: 14, color: Brand.onLightMuted, lineHeight: 20, marginTop: 8, textAlign: 'center' },
  email: { color: Brand.onLight, fontWeight: '700' },
  codeRow: { flexDirection: 'row', gap: 12, marginTop: 28 },
  codeBox: {
    width: 62, height: 68, borderRadius: 16,
    backgroundColor: Brand.white, borderWidth: 2, borderColor: '#E7E8EE',
    fontSize: 28, fontWeight: '800', color: Brand.onLight,
  },
  codeBoxLleno: { borderColor: Brand.primary, backgroundColor: Brand.primary + '0A' },
  reenviarWrap: { marginTop: 18 },
  reenviarText: { fontSize: 13, color: Brand.onLightMuted },
  reenviarLink: { color: Brand.red, fontWeight: '700' },
  btnVerde: {
    width: '100%', backgroundColor: Brand.primary, borderRadius: 16, height: 54,
    alignItems: 'center', justifyContent: 'center', marginTop: 24,
    shadowColor: Brand.primary, shadowOpacity: 0.3, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 6,
  },
  btnDeshabilitado: { opacity: 0.5 },
  btnVerdeText: { color: Brand.white, fontSize: 16, fontWeight: '700' },
  expira: { fontSize: 12, color: Brand.onLightMuted, marginTop: 16 },
});
