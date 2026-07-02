import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { db } from '@/config/firebase';
import { Brand } from '@/constants/brand';
import { REGION } from '@/constants/zonas';
import type { Rifa } from '@/types/rifa';

const SIN_ZONA = 'Sin zona';

function fechaSorteoDe(r: Rifa): Date | null {
  return (r.fecha_sorteo as any)?.toDate?.() ?? null;
}

/** Cuenta regresiva "02d : 14h : 32m" hacia la fecha del sorteo. */
function Countdown({ fecha }: { fecha: Date | null }) {
  const [ahora, setAhora] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  if (!fecha) {
    return (
      <View style={styles.countdownPill}>
        <Ionicons name="calendar-outline" size={12} color={Brand.onLightMuted} />
        <Text style={styles.countdownTextMuted}>Sin fecha</Text>
      </View>
    );
  }

  const diff = fecha.getTime() - ahora;
  if (diff <= 0) {
    return (
      <View style={styles.countdownPill}>
        <Text style={styles.countdownTextMuted}>Finalizada</Text>
      </View>
    );
  }

  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const p = (n: number) => String(n).padStart(2, '0');

  return (
    <View style={[styles.countdownPill, styles.countdownActivo]}>
      <Text style={styles.countdownText}>{p(d)}d : {p(h)}h : {p(m)}m</Text>
    </View>
  );
}

/** Imagen del premio con placeholder si no hay foto. */
function PremioImg({ uri, style }: { uri?: string; style: any }) {
  if (uri) {
    return <Image source={{ uri }} style={style} contentFit="cover" />;
  }
  return (
    <View style={[style, styles.imgPlaceholder]}>
      <Ionicons name="gift-outline" size={30} color={Brand.onLightMuted} />
    </View>
  );
}

export default function ZonaScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { zona } = useLocalSearchParams<{ zona: string }>();
  const nombreZona = decodeURIComponent(zona ?? '');

  const [rifas, setRifas] = useState<Rifa[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    const q = query(
      collection(db, 'rifas'),
      where('estado', '==', 'activa'),
      orderBy('creado_en', 'desc'),
    );
    const unsub = onSnapshot(q, (snap) => {
      setRifas(snap.docs.map(d => ({ id: d.id, ...d.data() } as Rifa)));
      setCargando(false);
    }, () => setCargando(false));

    return unsub;
  }, []);

  const rifasZona = useMemo(() => {
    const t = busqueda.trim().toLowerCase();
    return rifas.filter(r => {
      const z = (r.zona ?? '').trim() || SIN_ZONA;
      if (z !== nombreZona) return false;
      if (!t) return true;
      return r.titulo.toLowerCase().includes(t) || r.premio.toLowerCase().includes(t);
    });
  }, [rifas, nombreZona, busqueda]);

  const destacada = rifasZona[0];
  const cercanas = rifasZona.slice(1);

  const irARifa = (id: string) => router.push(`/rifa/${id}` as any);

  return (
    <View style={styles.root}>
      {/* Header verde */}
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <View style={styles.headerTop}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={Brand.white} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitulo}>Te podría interesar</Text>
            <Text style={styles.headerSub}>{nombreZona} · {REGION}</Text>
          </View>
        </View>

        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={18} color={Brand.onLightMuted} />
          <TextInput
            style={styles.searchInput}
            value={busqueda}
            onChangeText={setBusqueda}
            placeholder="Buscar rifas, premios…"
            placeholderTextColor={Brand.onLightMuted}
          />
          {busqueda ? (
            <Pressable onPress={() => setBusqueda('')}>
              <Ionicons name="close-circle" size={18} color={Brand.onLightMuted} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {cargando ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Brand.primary} />
        </View>
      ) : rifasZona.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="ticket-outline" size={48} color={Brand.onLightMuted} />
          <Text style={styles.emptyTitle}>
            {busqueda ? 'Sin resultados en esta zona' : 'No hay rifas activas en esta zona'}
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}>

          {/* Rifa destacada */}
          {destacada && (
            <Pressable
              style={({ pressed }) => [styles.destacadaCard, pressed && { opacity: 0.95 }]}
              onPress={() => irARifa(destacada.id)}>
              <View>
                <PremioImg uri={destacada.premio_imagen} style={styles.destacadaImg} />
                <View style={styles.destacadaBadge}>
                  <Text style={styles.destacadaBadgeText}>DESTACADO</Text>
                </View>
              </View>
              <View style={styles.destacadaBody}>
                <Text style={styles.destacadaTitulo} numberOfLines={1}>{destacada.titulo}</Text>
                <Text style={styles.destacadaZona} numberOfLines={1}>{nombreZona}</Text>
                <View style={styles.destacadaFooter}>
                  <Text style={styles.destacadaPrecio}>₡{(destacada.precio ?? 0).toLocaleString('es-CR')}</Text>
                  <Countdown fecha={fechaSorteoDe(destacada)} />
                </View>
              </View>
            </Pressable>
          )}

          {/* Rifas cercanas */}
          {cercanas.length > 0 && (
            <>
              <Text style={styles.seccion}>Rifas cercanas a ti</Text>
              <View style={styles.grid}>
                {cercanas.map(r => (
                  <Pressable
                    key={r.id}
                    style={({ pressed }) => [styles.gridCard, pressed && { opacity: 0.95 }]}
                    onPress={() => irARifa(r.id)}>
                    <PremioImg uri={r.premio_imagen} style={styles.gridImg} />
                    <View style={styles.gridBody}>
                      <Text style={styles.gridTitulo} numberOfLines={1}>{r.titulo}</Text>
                      <Text style={styles.gridZona} numberOfLines={1}>{nombreZona}</Text>
                      <Text style={styles.gridPrecio}>₡{(r.precio ?? 0).toLocaleString('es-CR')}</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.cream },

  header: {
    backgroundColor: Brand.primaryDark,
    paddingHorizontal: 16,
    paddingBottom: 18,
    gap: 14,
  },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  backBtn: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: Brand.white + '1A',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitulo: { fontSize: 20, fontWeight: '800', color: Brand.white },
  headerSub: { fontSize: 12, color: Brand.onDarkMuted, marginTop: 2 },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Brand.white, borderRadius: 14, paddingHorizontal: 14, height: 48,
  },
  searchInput: { flex: 1, fontSize: 14, color: Brand.onLight },

  scroll: { padding: 16, paddingBottom: 28 },

  // Destacada
  destacadaCard: {
    backgroundColor: Brand.white, borderRadius: 18, overflow: 'hidden', marginBottom: 22,
    borderWidth: 1, borderColor: Brand.onLight + '10',
    shadowColor: Brand.onLight, shadowOpacity: 0.08, shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 }, elevation: 4,
  },
  destacadaImg: { width: '100%', height: 180 },
  destacadaBadge: {
    position: 'absolute', top: 12, left: 12,
    backgroundColor: Brand.accent, borderRadius: 8,
    paddingVertical: 5, paddingHorizontal: 10,
  },
  destacadaBadgeText: { fontSize: 11, fontWeight: '900', color: Brand.primaryDeep, letterSpacing: 0.5 },
  destacadaBody: { padding: 16, gap: 4 },
  destacadaTitulo: { fontSize: 18, fontWeight: '800', color: Brand.onLight },
  destacadaZona: { fontSize: 13, color: Brand.onLightMuted },
  destacadaFooter: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6,
  },
  destacadaPrecio: { fontSize: 22, fontWeight: '900', color: Brand.primary },

  // Countdown
  countdownPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: 20, paddingVertical: 6, paddingHorizontal: 12,
    backgroundColor: '#F0F4F3',
  },
  countdownActivo: { backgroundColor: Brand.red + '18' },
  countdownText: { fontSize: 13, fontWeight: '800', color: Brand.red },
  countdownTextMuted: { fontSize: 12, fontWeight: '700', color: Brand.onLightMuted },

  // Grid cercanas
  seccion: { fontSize: 16, fontWeight: '800', color: Brand.onLight, marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  gridCard: {
    width: '48%', marginBottom: 16,
    backgroundColor: Brand.white, borderRadius: 16, overflow: 'hidden',
    borderWidth: 1, borderColor: Brand.onLight + '10',
    shadowColor: Brand.onLight, shadowOpacity: 0.06, shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }, elevation: 2,
  },
  gridImg: { width: '100%', height: 110 },
  gridBody: { padding: 12, gap: 2 },
  gridTitulo: { fontSize: 14, fontWeight: '800', color: Brand.onLight },
  gridZona: { fontSize: 12, color: Brand.onLightMuted },
  gridPrecio: { fontSize: 15, fontWeight: '900', color: Brand.primary, marginTop: 4 },

  imgPlaceholder: {
    backgroundColor: '#EEEBDD', alignItems: 'center', justifyContent: 'center',
  },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 32 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: Brand.onLightMuted, textAlign: 'center' },
});
