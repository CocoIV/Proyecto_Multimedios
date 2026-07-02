import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { db } from '@/config/firebase';
import { Brand } from '@/constants/brand';
import type { Rifa } from '@/types/rifa';

const SIN_ZONA = 'Sin zona';

// Colores para el punto de cada zona (se cicla por índice).
const ZONA_COLORS = [Brand.primary, Brand.red, Brand.accent, Brand.success, Brand.accentText, Brand.primaryDark];

type ZonaAgrupada = {
  nombre: string;
  cantidad: number;
  disponibles: number;
};

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
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

  // Agrupar rifas activas por zona
  const zonas = useMemo<ZonaAgrupada[]>(() => {
    const mapa = new Map<string, ZonaAgrupada>();
    for (const r of rifas) {
      const nombre = (r.zona ?? '').trim() || SIN_ZONA;
      const disp = Math.max(0, (r.total_numeros ?? 0) - (r.vendidos ?? 0));
      const prev = mapa.get(nombre);
      if (prev) {
        prev.cantidad += 1;
        prev.disponibles += disp;
      } else {
        mapa.set(nombre, { nombre, cantidad: 1, disponibles: disp });
      }
    }
    return [...mapa.values()].sort((a, b) => b.cantidad - a.cantidad);
  }, [rifas]);

  const populares = useMemo(() => zonas.slice(0, 4).map(z => z.nombre), [zonas]);

  const zonasFiltradas = useMemo(() => {
    const t = busqueda.trim().toLowerCase();
    if (!t) return zonas;
    return zonas.filter(z => z.nombre.toLowerCase().includes(t));
  }, [zonas, busqueda]);

  function abrirZona(nombre: string) {
    router.push(`/zona/${encodeURIComponent(nombre)}` as any);
  }

  return (
    <View style={styles.root}>
      {/* Header verde con buscador */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerTop}>
          <Text style={styles.titulo}>Explorar por zona</Text>
          <Pressable
            style={({ pressed }) => [styles.trofeoBtn, pressed && { opacity: 0.8 }]}
            onPress={() => router.push('/resultados' as any)}>
            <Ionicons name="trophy-outline" size={20} color={Brand.accent} />
          </Pressable>
        </View>

        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={18} color={Brand.onLightMuted} />
          <TextInput
            style={styles.searchInput}
            value={busqueda}
            onChangeText={setBusqueda}
            placeholder="Buscar provincia o cantón…"
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
      ) : (
        <FlatList
          data={zonasFiltradas}
          keyExtractor={z => z.nombre}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <>
              {populares.length > 0 && !busqueda ? (
                <>
                  <Text style={styles.seccion}>Populares</Text>
                  <View style={styles.chipsRow}>
                    {populares.map((nombre, i) => (
                      <Pressable
                        key={nombre}
                        onPress={() => abrirZona(nombre)}
                        style={({ pressed }) => [
                          styles.chip,
                          i === 0 && styles.chipActivo,
                          pressed && { opacity: 0.85 },
                        ]}>
                        <Text style={[styles.chipText, i === 0 && styles.chipTextActivo]}>{nombre}</Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              ) : null}
              <Text style={styles.seccion}>Zonas con rifas activas</Text>
            </>
          }
          renderItem={({ item, index }) => (
            <Pressable
              style={({ pressed }) => [styles.zonaCard, pressed && { opacity: 0.9 }]}
              onPress={() => abrirZona(item.nombre)}>
              <View style={[styles.zonaDot, { backgroundColor: ZONA_COLORS[index % ZONA_COLORS.length] }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.zonaNombre} numberOfLines={1}>{item.nombre}</Text>
                <Text style={styles.zonaSub} numberOfLines={1}>{item.disponibles} boletos disponibles</Text>
              </View>
              <View style={styles.zonaBadge}>
                <Text style={styles.zonaBadgeText}>
                  {item.cantidad} rifa{item.cantidad !== 1 ? 's' : ''}
                </Text>
              </View>
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="map-outline" size={48} color={Brand.onLightMuted} />
              <Text style={styles.emptyTitle}>
                {busqueda ? 'Ninguna zona coincide' : 'No hay rifas activas por ahora'}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.cream },

  header: {
    backgroundColor: Brand.primaryDark,
    paddingHorizontal: 20,
    paddingBottom: 18,
    gap: 14,
  },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  titulo: { flex: 1, fontSize: 22, fontWeight: '800', color: Brand.white },
  trofeoBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: Brand.white + '1A',
    alignItems: 'center', justifyContent: 'center',
  },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Brand.white, borderRadius: 14, paddingHorizontal: 14, height: 48,
  },
  searchInput: { flex: 1, fontSize: 14, color: Brand.onLight },

  list: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 },
  seccion: { fontSize: 16, fontWeight: '800', color: Brand.onLight, marginBottom: 10, marginTop: 4 },

  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  chip: {
    paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20,
    borderWidth: 1.5, borderColor: Brand.primary + '55', backgroundColor: Brand.white,
  },
  chipActivo: { backgroundColor: Brand.primary, borderColor: Brand.primary },
  chipText: { fontSize: 13, fontWeight: '700', color: Brand.primary },
  chipTextActivo: { color: Brand.white },

  zonaCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Brand.white, borderRadius: 16, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: Brand.onLight + '10',
    shadowColor: Brand.onLight, shadowOpacity: 0.06, shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }, elevation: 2,
  },
  zonaDot: { width: 16, height: 16, borderRadius: 8 },
  zonaNombre: { fontSize: 16, fontWeight: '800', color: Brand.onLight },
  zonaSub: { fontSize: 12, color: Brand.onLightMuted, marginTop: 2 },
  zonaBadge: {
    backgroundColor: Brand.accent + '22', borderRadius: 20,
    paddingVertical: 6, paddingHorizontal: 12,
  },
  zonaBadgeText: { fontSize: 12, fontWeight: '800', color: Brand.accentText },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: Brand.onLightMuted, textAlign: 'center' },
});
