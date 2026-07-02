import { Ionicons } from '@expo/vector-icons';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { db } from '@/config/firebase';
import { Brand } from '@/constants/brand';
import type { Rifa } from '@/types/rifa';

export default function ResultadosScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [rifas, setRifas] = useState<Rifa[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'rifas'),
      where('estado', '==', 'sorteada'),
      orderBy('sorteado_en', 'desc'),
    );
    return onSnapshot(q, snap => {
      setRifas(snap.docs.map(d => ({ id: d.id, ...d.data() } as Rifa)));
      setCargando(false);
    }, () => setCargando(false));
  }, []);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* NavBar */}
      <View style={styles.navBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Brand.onLight} />
        </Pressable>
        <Text style={styles.navTitulo}>Resultados de Sorteos</Text>
        <View style={{ width: 40 }} />
      </View>

      {cargando ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Brand.primary} />
        </View>
      ) : (
        <FlatList
          data={rifas}
          keyExtractor={r => r.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            rifas.length > 0 ? (
              <View style={styles.heroBanner}>
                <Ionicons name="trophy" size={32} color={Brand.accent} />
                <Text style={styles.heroTitulo}>Ganadores oficiales</Text>
                <Text style={styles.heroSub}>
                  {rifas.length} rifa{rifas.length !== 1 ? 's' : ''} sorteada{rifas.length !== 1 ? 's' : ''}
                </Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="trophy-outline" size={56} color={Brand.onLightMuted} />
              <Text style={styles.emptyTitulo}>Aún no hay sorteos</Text>
              <Text style={styles.emptySub}>
                Cuando se realice un sorteo, el ganador aparecerá aquí.
              </Text>
            </View>
          }
          renderItem={({ item: r }) => {
            const fecha = r.sorteado_en
              ? (r.sorteado_en as any).toDate?.().toLocaleDateString('es-CR', {
                  day: 'numeric', month: 'long', year: 'numeric',
                })
              : null;

            return (
              <Pressable
                style={({ pressed }) => [styles.card, pressed && { opacity: 0.93 }]}
                onPress={() => router.push(`/ganador/${r.id}` as any)}>

                {/* Header */}
                <View style={styles.cardHeader}>
                  <View style={styles.trofeoCircle}>
                    <Ionicons name="trophy" size={20} color={Brand.white} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitulo} numberOfLines={1}>{r.titulo}</Text>
                    <Text style={styles.cardPremio}>🎁 {r.premio}</Text>
                  </View>
                  <View style={styles.sorteadaBadge}>
                    <Text style={styles.sorteadaText}>Sorteada</Text>
                  </View>
                </View>

                {/* Ganador */}
                <View style={styles.ganadorSection}>
                  <View style={styles.numeroBadge}>
                    <Text style={styles.numeroLabel}>NÚMERO</Text>
                    <Text style={styles.numeroValor}>#{r.ganador_numero}</Text>
                  </View>
                  <View style={styles.ganadorInfo}>
                    <Text style={styles.ganadorNombreLabel}>Ganador</Text>
                    <Text style={styles.ganadorNombre}>{r.ganador_nombre}</Text>
                    <Text style={styles.ganadorTel}>{r.ganador_telefono}</Text>
                  </View>
                </View>

                {/* Footer */}
                <View style={styles.cardFooter}>
                  {fecha && (
                    <View style={styles.fechaRow}>
                      <Ionicons name="calendar-outline" size={13} color={Brand.onLightMuted} />
                      <Text style={styles.fechaText}>Sorteada el {fecha}</Text>
                    </View>
                  )}
                  <View style={styles.statsRow}>
                    <Text style={styles.statText}>{r.total_numeros} números</Text>
                    <Text style={styles.statSep}>·</Text>
                    <Text style={styles.statText}>₡{(r.precio ?? 0).toLocaleString('es-CR')} c/u</Text>
                  </View>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.cream },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  navBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: Brand.white, borderBottomWidth: 1, borderBottomColor: '#E7EEED',
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: '#F0F4F3',
    alignItems: 'center', justifyContent: 'center',
  },
  navTitulo: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: Brand.onLight, marginHorizontal: 8 },

  list: { padding: 16, gap: 14, paddingBottom: 32 },

  heroBanner: {
    alignItems: 'center', gap: 6, paddingVertical: 20,
    backgroundColor: Brand.primaryDark, borderRadius: 18, marginBottom: 8, padding: 20,
  },
  heroTitulo: { fontSize: 20, fontWeight: '800', color: Brand.white },
  heroSub: { fontSize: 13, color: Brand.onDarkMuted },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingTop: 80, paddingHorizontal: 32 },
  emptyTitulo: { fontSize: 18, fontWeight: '700', color: Brand.onLight },
  emptySub: { fontSize: 13, color: Brand.onLightMuted, textAlign: 'center', lineHeight: 19 },

  card: {
    backgroundColor: Brand.white, borderRadius: 18, overflow: 'hidden',
    borderWidth: 1, borderColor: '#E7EEED',
    shadowColor: '#0A4D4A', shadowOpacity: 0.07, shadowRadius: 12, elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 16, borderBottomWidth: 1, borderBottomColor: '#F0F4F3',
  },
  trofeoCircle: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: Brand.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  cardTitulo: { fontSize: 15, fontWeight: '800', color: Brand.onLight },
  cardPremio: { fontSize: 12, color: Brand.onLightMuted, marginTop: 1 },
  sorteadaBadge: {
    backgroundColor: Brand.accent + '22', borderRadius: 20,
    paddingVertical: 4, paddingHorizontal: 10, borderWidth: 1, borderColor: Brand.accent + '55',
  },
  sorteadaText: { fontSize: 11, fontWeight: '700', color: '#B07D00' },

  ganadorSection: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    padding: 16, backgroundColor: Brand.primaryDark,
  },
  numeroBadge: { alignItems: 'center', gap: 2 },
  numeroLabel: { fontSize: 9, fontWeight: '700', color: Brand.onDarkMuted, letterSpacing: 1 },
  numeroValor: { fontSize: 26, fontWeight: '900', color: Brand.accent, letterSpacing: 2 },
  ganadorInfo: { flex: 1 },
  ganadorNombreLabel: { fontSize: 10, fontWeight: '700', color: Brand.onDarkMuted, textTransform: 'uppercase', letterSpacing: 0.8 },
  ganadorNombre: { fontSize: 17, fontWeight: '800', color: Brand.white, marginTop: 2 },
  ganadorTel: { fontSize: 13, color: Brand.onDarkMuted, marginTop: 2 },

  cardFooter: {
    padding: 12, paddingHorizontal: 16, gap: 4, backgroundColor: '#FAFBFB',
  },
  fechaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  fechaText: { fontSize: 12, color: Brand.onLightMuted },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statText: { fontSize: 12, color: Brand.onLightMuted },
  statSep: { fontSize: 12, color: Brand.onLightMuted },
});
