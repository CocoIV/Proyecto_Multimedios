import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { db } from '@/config/firebase';
import { AppInfo, Brand } from '@/constants/brand';
import type { Rifa } from '@/types/rifa';

export default function MiPremioScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [rifa, setRifa] = useState<Rifa | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!id) return;
    return onSnapshot(doc(db, 'rifas', id), snap => {
      if (snap.exists()) setRifa({ id: snap.id, ...snap.data() } as Rifa);
      setCargando(false);
    }, () => setCargando(false));
  }, [id]);

  const valor = rifa ? (rifa.precio ?? 0) * (rifa.total_numeros ?? 0) : 0;
  const watermark = rifa?.premio.match(/\d+/)?.[0] ?? '★';

  function verQR() {
    if (rifa?.ganador_numero) {
      router.push(`/boleto/${id}/${rifa.ganador_numero}` as any);
    }
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header verde */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Brand.white} />
        </Pressable>
        <Text style={styles.headerTitulo}>Mi Premio</Text>
        <View style={{ width: 40 }} />
      </View>

      {cargando ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Brand.primary} />
        </View>
      ) : !rifa ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>Premio no encontrado.</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}>

          {/* Hero del premio */}
          <View style={styles.hero}>
            <Text style={styles.heroWatermark}>{watermark}</Text>
            <View style={styles.heroIcono}>
              <Ionicons name="gift" size={56} color={Brand.white} />
            </View>
          </View>

          <Text style={styles.premioTitulo}>{rifa.premio || rifa.titulo}</Text>
          {valor > 0 && (
            <Text style={styles.premioValor}>Valor aproximado: ₡{valor.toLocaleString('es-CR')}</Text>
          )}

          {/* Cómo reclamar */}
          <View style={styles.card}>
            <Text style={styles.cardTitulo}>Cómo reclamar tu premio</Text>
            <Text style={styles.paso}>1. Presentá tu boleto QR al dueño de la rifa</Text>
            <Text style={styles.paso}>2. Llevá tu cédula de identidad vigente</Text>
            <Text style={styles.paso}>3. Plazo máximo para reclamar: 30 días</Text>
            <View style={styles.contactoWrap}>
              <Ionicons name="call" size={14} color={Brand.primary} />
              <Text style={styles.contacto}>
                Organiza: {rifa.creado_por_nombre || 'Tombolitas CR'} · {AppInfo.region}
              </Text>
            </View>
          </View>

          {/* Botón QR */}
          <Pressable style={({ pressed }) => [styles.btnQR, pressed && { opacity: 0.9 }]} onPress={verQR}>
            <Ionicons name="qr-code" size={18} color={Brand.white} />
            <Text style={styles.btnQRText}>QR</Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.cream },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { fontSize: 15, color: Brand.onLightMuted },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 14, paddingTop: 6,
    backgroundColor: Brand.primaryDark,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: Brand.white + '1A',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitulo: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '800', color: Brand.white, marginHorizontal: 8 },

  scroll: { padding: 20, gap: 12 },

  hero: {
    height: 190, borderRadius: 20, overflow: 'hidden',
    backgroundColor: Brand.primaryDeep,
    alignItems: 'center', justifyContent: 'center',
  },
  heroWatermark: {
    position: 'absolute', fontSize: 160, fontWeight: '900',
    color: Brand.white + '14', letterSpacing: 4,
  },
  heroIcono: {
    width: 90, height: 90, borderRadius: 24, backgroundColor: Brand.white + '1A',
    alignItems: 'center', justifyContent: 'center',
  },

  premioTitulo: { fontSize: 24, fontWeight: '800', color: Brand.onLight, textAlign: 'center', marginTop: 6 },
  premioValor: { fontSize: 14, fontWeight: '700', color: Brand.success, textAlign: 'center' },

  card: {
    backgroundColor: Brand.white, borderRadius: 18, padding: 18, gap: 12, marginTop: 8,
    borderWidth: 1, borderColor: Brand.onLight + '10',
    shadowColor: Brand.onLight, shadowOpacity: 0.06, shadowRadius: 12, elevation: 3,
  },
  cardTitulo: { fontSize: 16, fontWeight: '800', color: Brand.primary },
  paso: { fontSize: 14, color: Brand.onLight, lineHeight: 20 },
  contactoWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4,
    borderTopWidth: 1, borderTopColor: Brand.onLight + '0F', paddingTop: 12,
  },
  contacto: { flex: 1, fontSize: 13, fontWeight: '700', color: Brand.primary },

  btnQR: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Brand.primaryDark, borderRadius: 16, height: 54, marginTop: 10,
  },
  btnQRText: { color: Brand.white, fontSize: 16, fontWeight: '800', letterSpacing: 1 },
});
