import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { db } from '@/config/firebase';
import { Brand } from '@/constants/brand';
import { useAuth } from '@/context/auth';
import type { Rifa } from '@/types/rifa';

const PIN_COLORS = [Brand.red, Brand.primary, Brand.accent];

/** Posición pseudo-aleatoria pero estable por rifa (derivada del id). */
function posicionPin(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const x = 8 + (h % 68);
  const y = 16 + (Math.floor(h / 68) % 50);
  return { x, y };
}

export default function InicioScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { perfil, user } = useAuth();
  const [rifas, setRifas] = useState<Rifa[]>([]);

  const primerNombre = (perfil?.nombre ?? user?.displayName ?? 'compañero').split(' ')[0];

  useEffect(() => {
    const q = query(collection(db, 'rifas'), where('estado', '==', 'activa'));
    return onSnapshot(q, snap => {
      setRifas(snap.docs.map(d => ({ id: d.id, ...d.data() } as Rifa)));
    }, () => {});
  }, []);

  const pins = useMemo(
    () => rifas.map((r, i) => ({
      rifa: r,
      color: PIN_COLORS[i % PIN_COLORS.length],
      ...posicionPin(r.id),
    })),
    [rifas],
  );

  return (
    <View style={styles.root}>
      {/* ===== Mapa estilizado ===== */}
      <View style={styles.mapa}>
        {/* Calles horizontales */}
        {[24, 48, 68].map(top => (
          <View key={`h${top}`} style={[styles.calleH, { top: `${top}%` }]} />
        ))}
        {/* Calles verticales */}
        {[30, 66].map(left => (
          <View key={`v${left}`} style={[styles.calleV, { left: `${left}%` }]} />
        ))}

        {/* Ubicación del usuario (centro) */}
        <View style={styles.userAura}>
          <View style={styles.userAura2}>
            <View style={styles.userDot} />
          </View>
        </View>

        {/* Pins de rifas */}
        {pins.map(({ rifa, color, x, y }) => (
          <Pressable
            key={rifa.id}
            style={[styles.pin, { backgroundColor: color, left: `${x}%`, top: `${y}%` }]}
            onPress={() => router.push(`/rifa/${rifa.id}` as any)}>
            <Text style={styles.pinText}>₡{(rifa.precio ?? 0).toLocaleString('es-CR')}</Text>
            <View style={[styles.pinTail, { borderTopColor: color }]} />
          </Pressable>
        ))}

        {rifas.length === 0 && (
          <View style={styles.sinRifas}>
            <Ionicons name="map-outline" size={40} color={Brand.onLightMuted} />
            <Text style={styles.sinRifasText}>No hay rifas activas en el mapa</Text>
          </View>
        )}
      </View>

      {/* ===== Barra de búsqueda flotante ===== */}
      <View style={[styles.searchBar, { top: insets.top + 12 }]}>
        <Ionicons name="search" size={18} color={Brand.onLightMuted} />
        <Pressable style={{ flex: 1 }} onPress={() => router.push('/(tabs)/explore' as any)}>
          <Text style={styles.searchPlaceholder}>Buscar rifas cerca de vos…</Text>
        </Pressable>
      </View>

      {/* Saludo flotante */}
      <View style={[styles.saludoChip, { top: insets.top + 68 }]}>
        <Text style={styles.saludoText}>¡Hola, {primerNombre}! 👋</Text>
      </View>

      {/* ===== Hoja inferior: rifas cerca ===== */}
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 8 }]}>
        <View style={styles.sheetHandle} />
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitulo}>Rifas cerca de vos</Text>
          <Pressable onPress={() => router.push('/(tabs)/explore' as any)}>
            <Text style={styles.verTodas}>Ver todas</Text>
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sheetScroll}>
          {rifas.length === 0 ? (
            <Text style={styles.sheetVacio}>Aún no hay rifas activas.</Text>
          ) : (
            rifas.map((r, i) => (
              <Pressable
                key={r.id}
                style={styles.miniCard}
                onPress={() => router.push(`/rifa/${r.id}` as any)}>
                <View style={[styles.miniDot, { backgroundColor: PIN_COLORS[i % PIN_COLORS.length] }]} />
                <Text style={styles.miniTitulo} numberOfLines={1}>{r.titulo}</Text>
                <Text style={styles.miniPremio} numberOfLines={1}>🎁 {r.premio}</Text>
                <Text style={styles.miniPrecio}>₡{(r.precio ?? 0).toLocaleString('es-CR')} / número</Text>
              </Pressable>
            ))
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#E1E9E1' },

  // --- Mapa ---
  mapa: { ...StyleSheet.absoluteFillObject, backgroundColor: '#E1E9E1' },
  calleH: { position: 'absolute', left: 0, right: 0, height: 24, backgroundColor: 'rgba(255,255,255,0.7)' },
  calleV: { position: 'absolute', top: 0, bottom: 0, width: 22, backgroundColor: 'rgba(255,255,255,0.7)' },

  userAura: {
    position: 'absolute', left: '46%', top: '44%',
    width: 56, height: 56, borderRadius: 28, backgroundColor: Brand.primary + '18',
    alignItems: 'center', justifyContent: 'center',
  },
  userAura2: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: Brand.primary + '30',
    alignItems: 'center', justifyContent: 'center',
  },
  userDot: {
    width: 16, height: 16, borderRadius: 8, backgroundColor: Brand.primary,
    borderWidth: 3, borderColor: Brand.white,
  },

  pin: {
    position: 'absolute',
    paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Brand.onLight, shadowOpacity: 0.3, shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 }, elevation: 5,
  },
  pinText: { color: Brand.white, fontWeight: '800', fontSize: 12 },
  pinTail: {
    position: 'absolute', bottom: -6, alignSelf: 'center',
    width: 0, height: 0,
    borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 8,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
  },
  sinRifas: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  sinRifasText: { fontSize: 14, color: Brand.onLightMuted, fontWeight: '600' },

  // --- Search flotante ---
  searchBar: {
    position: 'absolute', left: 16, right: 16,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Brand.white, borderRadius: 16, paddingHorizontal: 14, height: 48,
    shadowColor: Brand.onLight, shadowOpacity: 0.15, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  searchPlaceholder: { fontSize: 14, color: Brand.onLight + '59' },

  saludoChip: {
    position: 'absolute', left: 16,
    backgroundColor: Brand.primary, borderRadius: 20,
    paddingVertical: 6, paddingHorizontal: 14,
    shadowColor: Brand.primaryDeep, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4,
  },
  saludoText: { color: Brand.white, fontSize: 13, fontWeight: '700' },

  // --- Hoja inferior ---
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: Brand.white,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 8, paddingHorizontal: 16,
    shadowColor: Brand.onLight, shadowOpacity: 0.12, shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 }, elevation: 10,
  },
  sheetHandle: {
    width: 54, height: 4, borderRadius: 2, backgroundColor: Brand.onLight + '26',
    alignSelf: 'center', marginBottom: 10,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sheetTitulo: { fontSize: 16, fontWeight: '800', color: Brand.onLight },
  verTodas: { fontSize: 13, fontWeight: '700', color: Brand.primary },
  sheetScroll: { gap: 12, paddingBottom: 10, paddingRight: 4 },
  sheetVacio: { fontSize: 13, color: Brand.onLightMuted, paddingVertical: 16 },
  miniCard: {
    width: 180, backgroundColor: Brand.cream, borderRadius: 16, padding: 14, gap: 3,
    borderWidth: 1, borderColor: Brand.onLight + '10',
  },
  miniDot: { width: 10, height: 10, borderRadius: 5, marginBottom: 4 },
  miniTitulo: { fontSize: 14, fontWeight: '800', color: Brand.onLight },
  miniPremio: { fontSize: 12, color: Brand.onLightMuted },
  miniPrecio: { fontSize: 13, fontWeight: '700', color: Brand.primary, marginTop: 4 },
});
