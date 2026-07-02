import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
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
import type { EstadoRifa, NumeroDoc, Rifa } from '@/types/rifa';

type NumeroConId = NumeroDoc & { numero: string; rifa_id: string };
type RifaGanada = Rifa & { miNumero: string };
type InfoRifa = { estado: EstadoRifa; fecha_sorteo?: any };

const ESTADO_BADGE: Record<EstadoRifa, { label: string; color: string }> = {
  activa: { label: 'ACTIVO', color: Brand.success },
  cerrada: { label: 'CERRADA', color: Brand.onLightMuted },
  sorteada: { label: 'FINALIZADO', color: Brand.accentText },
};

export default function MisNumerosScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [numeros, setNumeros] = useState<NumeroConId[]>([]);
  const [rifasGanadas, setRifasGanadas] = useState<RifaGanada[]>([]);
  const [infoRifas, setInfoRifas] = useState<Record<string, InfoRifa>>({});
  const [cargando, setCargando] = useState(true);
  const [ahora, setAhora] = useState(Date.now());

  // Tick para la cuenta regresiva.
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collectionGroup(db, 'numeros'),
      where('comprador_uid', '==', user.uid),
      orderBy('comprado_en', 'desc'),
    );

    const unsub = onSnapshot(q, async (snap) => {
      const docs = snap.docs.map(d => {
        const rifaId = d.ref.parent.parent?.id ?? '';
        return { ...(d.data() as NumeroDoc), numero: d.id, rifa_id: rifaId };
      });
      setNumeros(docs);
      setCargando(false);

      // Rifas ganadas por el usuario.
      try {
        const rifasSnap = await getDocs(
          query(collection(db, 'rifas'), where('estado', '==', 'sorteada'), where('ganador_uid', '==', user.uid))
        );
        setRifasGanadas(rifasSnap.docs.map(d => {
          const rifa = { id: d.id, ...d.data() } as Rifa;
          return { ...rifa, miNumero: rifa.ganador_numero ?? '' };
        }));
      } catch { /* silencioso */ }
    }, (err) => {
      console.error('Error en Mis Boletos:', err.message, err);
      setCargando(false);
    });

    return unsub;
  }, [user]);

  // Info (estado + fecha de sorteo) de cada rifa comprada.
  const idsKey = useMemo(
    () => [...new Set(numeros.map(n => n.rifa_id))].filter(Boolean).sort().join(','),
    [numeros],
  );
  useEffect(() => {
    const ids = idsKey ? idsKey.split(',') : [];
    if (ids.length === 0) { setInfoRifas({}); return; }
    let activo = true;
    Promise.all(ids.map(async id => {
      const snap = await getDoc(doc(db, 'rifas', id));
      return [id, snap.exists() ? (snap.data() as Rifa) : null] as const;
    })).then(entries => {
      if (!activo) return;
      const map: Record<string, InfoRifa> = {};
      entries.forEach(([id, data]) => {
        if (data) map[id] = { estado: data.estado, fecha_sorteo: data.fecha_sorteo };
      });
      setInfoRifas(map);
    });
    return () => { activo = false; };
  }, [idsKey]);

  // Agrupar por rifa.
  const grupos = useMemo(() => {
    const porRifa = numeros.reduce<Record<string, NumeroConId[]>>((acc, n) => {
      const key = `${n.rifa_id}||${n.rifa_titulo}`;
      (acc[key] ??= []).push(n);
      return acc;
    }, {});
    return Object.entries(porRifa).map(([key, nums]) => {
      const [rifa_id, rifa_titulo] = key.split('||');
      return { rifa_id, rifa_titulo, numeros: nums };
    });
  }, [numeros]);

  function cuentaRegresiva(fecha: any): string | null {
    const d = fecha?.toDate?.();
    if (!d) return null;
    let diff = d.getTime() - ahora;
    if (diff <= 0) return 'Sorteo en curso';
    const dias = Math.floor(diff / 86400000); diff -= dias * 86400000;
    const horas = Math.floor(diff / 3600000); diff -= horas * 3600000;
    const mins = Math.floor(diff / 60000);
    if (dias > 0) return `${dias}d ${horas}h ${mins}m`;
    if (horas > 0) return `${horas}h ${mins}m`;
    return `${mins}m`;
  }

  if (cargando) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator size="large" color={Brand.primary} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* Header verde */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Text style={styles.headerTitulo}>Mis Boletos</Text>
      </View>

      {grupos.length === 0 && rifasGanadas.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="ticket-outline" size={52} color={Brand.onLightMuted} />
          <Text style={styles.emptyTitle}>Todavía no tenés boletos</Text>
          <Text style={styles.emptyHint}>Explorá las rifas activas y elegí tus números</Text>
          <Pressable
            style={({ pressed }) => [styles.irBtn, pressed && { opacity: 0.85 }]}
            onPress={() => router.push('/(tabs)/explore' as any)}>
            <Text style={styles.irBtnText}>Ver rifas</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={grupos}
          keyExtractor={g => g.rifa_id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            rifasGanadas.length > 0 ? (
              <View style={{ gap: 12, marginBottom: 4 }}>
                {rifasGanadas.map(r => (
                  <Pressable
                    key={r.id}
                    style={({ pressed }) => [styles.ganadoBanner, pressed && { opacity: 0.92 }]}
                    onPress={() => router.push(`/ganador/${r.id}` as any)}>
                    <View style={styles.ganadoTrofeo}>
                      <Ionicons name="trophy" size={22} color={Brand.primaryDark} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.ganadoLabel}>¡GANASTE!</Text>
                      <Text style={styles.ganadoRifa} numberOfLines={1}>{r.titulo}</Text>
                      <Text style={styles.ganadoNum}>Tu número #{r.miNumero} fue el ganador 🎉</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={Brand.primaryDark} />
                  </Pressable>
                ))}
              </View>
            ) : null
          }
          renderItem={({ item: grupo }) => {
            const info = infoRifas[grupo.rifa_id];
            const estado = info?.estado ?? 'activa';
            const badge = ESTADO_BADGE[estado];
            const countdown = cuentaRegresiva(info?.fecha_sorteo);

            return (
              <View style={[styles.card, { borderLeftColor: badge.color }]}>
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitulo} numberOfLines={1}>{grupo.rifa_titulo}</Text>

                    <Text style={styles.numerosLinea}>
                      Boleto{' '}
                      {grupo.numeros.map((n, i) => (
                        <Text
                          key={n.numero}
                          style={styles.numeroLink}
                          onPress={() => router.push(`/boleto/${grupo.rifa_id}/${n.numero}` as any)}>
                          {i > 0 ? ' · ' : ''}#{n.numero}
                        </Text>
                      ))}
                    </Text>

                    <Text style={styles.zona}>{AppInfo.region}</Text>

                    <Text style={styles.sorteoLinea}>
                      {estado === 'sorteada'
                        ? 'Sorteo finalizado'
                        : countdown
                          ? `Sorteo en: ${countdown}`
                          : 'Sorteo por definir'}
                    </Text>
                  </View>

                  <View style={[styles.badge, { backgroundColor: badge.color + '1A' }]}>
                    <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.cream },
  center: { alignItems: 'center', justifyContent: 'center' },

  header: {
    backgroundColor: Brand.primaryDark,
    paddingBottom: 16, paddingHorizontal: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitulo: { fontSize: 20, fontWeight: '800', color: Brand.white },

  list: { padding: 16, gap: 12, paddingBottom: 24 },

  card: {
    backgroundColor: Brand.white,
    borderRadius: 16,
    padding: 16,
    borderLeftWidth: 5,
    borderWidth: 1, borderColor: Brand.onLight + '0F',
    shadowColor: Brand.onLight, shadowOpacity: 0.06, shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }, elevation: 2,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardTitulo: { fontSize: 16, fontWeight: '800', color: Brand.onLight },
  numerosLinea: { fontSize: 13, color: Brand.onLightMuted, marginTop: 3 },
  numeroLink: { color: Brand.primary, fontWeight: '700' },
  zona: { fontSize: 12, color: Brand.onLightMuted, marginTop: 3 },
  sorteoLinea: { fontSize: 13, fontWeight: '700', color: Brand.accentText, marginTop: 6 },

  badge: {
    paddingVertical: 4, paddingHorizontal: 10, borderRadius: 20,
  },
  badgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },

  // Banner de ganador
  ganadoBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Brand.accent, borderRadius: 16, padding: 14,
    shadowColor: Brand.accent, shadowOpacity: 0.3, shadowRadius: 10, elevation: 4,
  },
  ganadoTrofeo: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Brand.white, alignItems: 'center', justifyContent: 'center',
  },
  ganadoLabel: { fontSize: 10, fontWeight: '800', color: Brand.primaryDark, letterSpacing: 1.5 },
  ganadoRifa: { fontSize: 14, fontWeight: '700', color: Brand.primaryDark, marginTop: 1 },
  ganadoNum: { fontSize: 12, color: Brand.primaryDark + 'CC', marginTop: 2 },

  // Vacío
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: Brand.onLight, textAlign: 'center' },
  emptyHint: { fontSize: 13, color: Brand.onLightMuted, textAlign: 'center', lineHeight: 19 },
  irBtn: { marginTop: 8, backgroundColor: Brand.primary, paddingVertical: 12, paddingHorizontal: 28, borderRadius: 14 },
  irBtnText: { color: Brand.white, fontWeight: '700', fontSize: 15 },
});
