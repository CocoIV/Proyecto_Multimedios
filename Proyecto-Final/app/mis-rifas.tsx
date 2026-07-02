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
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { db } from '@/config/firebase';
import { AppInfo, Brand } from '@/constants/brand';
import { useAuth } from '@/context/auth';
import type { EstadoRifa, Rifa } from '@/types/rifa';

const ESTADO_BADGE: Record<EstadoRifa, { label: string; color: string }> = {
  activa: { label: 'ACTIVA', color: Brand.success },
  cerrada: { label: 'CERRADA', color: Brand.onLightMuted },
  sorteada: { label: 'SORTEADA', color: Brand.accentText },
};

function fechaSorteo(rifa: Rifa): string {
  const d = (rifa.fecha_sorteo as any)?.toDate?.() ?? (rifa.sorteado_en as any)?.toDate?.();
  if (!d) return 'Sorteo por definir';
  return `Sorteo ${d.toLocaleDateString('es-CR', { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

export default function MisRifasScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [rifas, setRifas] = useState<Rifa[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'rifas'),
      where('creado_por_uid', '==', user.uid),
      orderBy('creado_en', 'desc'),
    );
    return onSnapshot(q, snap => {
      setRifas(snap.docs.map(d => ({ id: d.id, ...d.data() } as Rifa)));
      setCargando(false);
    }, (err) => {
      console.error('Error en Mis Rifas:', err.message, err);
      setCargando(false);
    });
  }, [user]);

  const { totalRecaudado, activas } = useMemo(() => {
    let total = 0, act = 0;
    for (const r of rifas) {
      total += (r.vendidos ?? 0) * (r.precio ?? 0);
      if (r.estado === 'activa') act++;
    }
    return { totalRecaudado: total, activas: act };
  }, [rifas]);

  return (
    <View style={styles.root}>
      {/* Header verde */}
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Brand.white} />
        </Pressable>
        <Text style={styles.headerTitulo}>Mis Rifas</Text>
        <Pressable
          style={({ pressed }) => [styles.nuevaBtn, pressed && { opacity: 0.85 }]}
          onPress={() => router.push('/crear-rifa' as any)}>
          <Ionicons name="add" size={16} color={Brand.primaryDeep} />
          <Text style={styles.nuevaText}>Nueva</Text>
        </Pressable>
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
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="albums-outline" size={52} color={Brand.onLightMuted} />
              <Text style={styles.emptyTitle}>Todavía no creaste rifas</Text>
              <Text style={styles.emptyHint}>Creá tu primera rifa y empezá a vender boletos</Text>
              <Pressable
                style={({ pressed }) => [styles.emptyBtn, pressed && { opacity: 0.85 }]}
                onPress={() => router.push('/crear-rifa' as any)}>
                <Text style={styles.emptyBtnText}>Crear rifa</Text>
              </Pressable>
            </View>
          }
          renderItem={({ item: r }) => {
            const pct = r.total_numeros > 0 ? (r.vendidos ?? 0) / r.total_numeros : 0;
            const recaudado = (r.vendidos ?? 0) * (r.precio ?? 0);
            const badge = ESTADO_BADGE[r.estado] ?? ESTADO_BADGE.activa;

            return (
              <Pressable
                style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]}
                onPress={() => router.push(`/admin-rifa/${r.id}` as any)}>
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitulo} numberOfLines={1}>{r.titulo}</Text>
                    <Text style={styles.cardSub}>{AppInfo.region} · {fechaSorteo(r)}</Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: badge.color + '1A' }]}>
                    <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
                  </View>
                </View>

                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${Math.round(pct * 100)}%` as any }]} />
                </View>

                <View style={styles.cardFooter}>
                  <Text style={styles.vendidos}>{r.vendidos ?? 0}/{r.total_numeros} boletos vendidos</Text>
                  <Text style={styles.recaudado}>₡{recaudado.toLocaleString('es-CR')} recaudados</Text>
                </View>
              </Pressable>
            );
          }}
        />
      )}

      {/* Balance total */}
      {!cargando && rifas.length > 0 && (
        <View style={[styles.balance, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.balanceInner}>
            <View style={{ flex: 1 }}>
              <Text style={styles.balanceLabel}>BALANCE TOTAL DE MIS RIFAS</Text>
              <Text style={styles.balanceMonto}>₡{totalRecaudado.toLocaleString('es-CR')}</Text>
            </View>
            <Text style={styles.balanceActivas}>{activas} rifa{activas !== 1 ? 's' : ''} activa{activas !== 1 ? 's' : ''}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.cream },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 14, gap: 8,
    backgroundColor: Brand.primaryDark,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: Brand.white + '1A',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitulo: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '800', color: Brand.white },
  nuevaBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Brand.accent, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20,
  },
  nuevaText: { color: Brand.primaryDeep, fontWeight: '800', fontSize: 13 },

  list: { padding: 16, gap: 12, paddingBottom: 24 },

  card: {
    backgroundColor: Brand.white, borderRadius: 16, padding: 16, gap: 12,
    borderWidth: 1, borderColor: Brand.onLight + '10',
    shadowColor: Brand.onLight, shadowOpacity: 0.06, shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }, elevation: 2,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardTitulo: { fontSize: 16, fontWeight: '800', color: Brand.onLight },
  cardSub: { fontSize: 12, color: Brand.onLightMuted, marginTop: 2 },
  badge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 20 },
  badgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  progressBar: { height: 6, borderRadius: 3, backgroundColor: '#EAE7DC', overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Brand.primary, borderRadius: 3 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  vendidos: { fontSize: 12, color: Brand.onLightMuted },
  recaudado: { fontSize: 14, fontWeight: '800', color: Brand.primary },

  empty: { alignItems: 'center', paddingTop: 70, gap: 10, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: Brand.onLight, textAlign: 'center' },
  emptyHint: { fontSize: 13, color: Brand.onLightMuted, textAlign: 'center', lineHeight: 19 },
  emptyBtn: { marginTop: 8, backgroundColor: Brand.primary, paddingVertical: 12, paddingHorizontal: 28, borderRadius: 14 },
  emptyBtnText: { color: Brand.white, fontWeight: '700', fontSize: 15 },

  // Balance
  balance: { paddingHorizontal: 16, paddingTop: 8 },
  balanceInner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Brand.primaryDark, borderRadius: 18, padding: 18,
    shadowColor: Brand.primaryDeep, shadowOpacity: 0.25, shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 }, elevation: 5,
  },
  balanceLabel: { fontSize: 10, fontWeight: '700', color: Brand.onDarkMuted, letterSpacing: 0.8 },
  balanceMonto: { fontSize: 28, fontWeight: '900', color: Brand.accent, marginTop: 4 },
  balanceActivas: { fontSize: 12, color: Brand.onDarkMuted },
});
