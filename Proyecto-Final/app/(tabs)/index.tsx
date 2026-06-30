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
import { AppInfo, Brand } from '@/constants/brand';
import { useAuth } from '@/context/auth';
import type { Rifa } from '@/types/rifa';

const ESTADO_LABEL: Record<string, string> = {
  activa: 'Activa',
  cerrada: 'Cerrada',
  sorteada: 'Sorteada',
};
const ESTADO_COLOR: Record<string, string> = {
  activa: Brand.success,
  cerrada: Brand.onLightMuted,
  sorteada: Brand.accent,
};

function RifaCard({ rifa, onPress }: { rifa: Rifa; onPress: () => void }) {
  const pct = rifa.total_numeros > 0 ? rifa.vendidos / rifa.total_numeros : 0;
  const disponibles = rifa.total_numeros - rifa.vendidos;
  const estadoColor = ESTADO_COLOR[rifa.estado] ?? Brand.onLightMuted;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]}
      onPress={onPress}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle} numberOfLines={1}>{rifa.titulo}</Text>
          <Text style={styles.cardPremio} numberOfLines={1}>🎁 {rifa.premio}</Text>
        </View>
        <View style={[styles.estadoBadge, { backgroundColor: estadoColor + '22', borderColor: estadoColor + '55' }]}>
          <View style={[styles.estadoDot, { backgroundColor: estadoColor }]} />
          <Text style={[styles.estadoText, { color: estadoColor }]}>{ESTADO_LABEL[rifa.estado]}</Text>
        </View>
      </View>

      {rifa.descripcion ? (
        <Text style={styles.cardDesc} numberOfLines={2}>{rifa.descripcion}</Text>
      ) : null}

      <View style={styles.progressWrap}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${Math.round(pct * 100)}%` as any }]} />
        </View>
        <View style={styles.progressRow}>
          <Text style={styles.progressText}>{rifa.vendidos} / {rifa.total_numeros} vendidos</Text>
          <Text style={styles.disponiblesText}>{disponibles} disponibles</Text>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <View style={styles.precioWrap}>
          <Ionicons name="pricetag-outline" size={13} color={Brand.primary} />
          <Text style={styles.precioText}>₡{(rifa.precio ?? 0).toLocaleString('es-CR')} / número</Text>
        </View>
        <View style={styles.verWrap}>
          <Text style={styles.verText}>Ver números</Text>
          <Ionicons name="chevron-forward" size={14} color={Brand.primary} />
        </View>
      </View>
    </Pressable>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, perfil } = useAuth();
  const [rifas, setRifas] = useState<Rifa[]>([]);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState<'activa' | 'todas'>('activa');

  const primerNombre = (perfil?.nombre ?? user?.displayName ?? 'compañero').split(' ')[0];
  const esAdmin = perfil?.rol === 'admin';

  useEffect(() => {
    const col = collection(db, 'rifas');
    const q = filtro === 'activa'
      ? query(col, where('estado', '==', 'activa'), orderBy('creado_en', 'desc'))
      : query(col, orderBy('creado_en', 'desc'));

    const unsub = onSnapshot(q, (snap) => {
      setRifas(snap.docs.map(d => ({ id: d.id, ...d.data() } as Rifa)));
      setCargando(false);
    }, () => setCargando(false));

    return unsub;
  }, [filtro]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.hello}>¡Hola, {primerNombre}!</Text>
          <Text style={styles.sub}>{AppInfo.region}</Text>
        </View>
        {esAdmin && (
          <Pressable
            style={({ pressed }) => [styles.crearBtn, pressed && { opacity: 0.85 }]}
            onPress={() => router.push('/crear-rifa')}>
            <Ionicons name="add" size={18} color={Brand.white} />
            <Text style={styles.crearText}>Nueva rifa</Text>
          </Pressable>
        )}
      </View>

      {/* Acceso a resultados de sorteos */}
      <Pressable
        style={({ pressed }) => [styles.resultadosBtn, pressed && { opacity: 0.88 }]}
        onPress={() => router.push('/resultados' as any)}>
        <Ionicons name="trophy-outline" size={15} color={Brand.accent} />
        <Text style={styles.resultadosBtnText}>Ver resultados de sorteos</Text>
        <Ionicons name="chevron-forward" size={14} color={Brand.accent} />
      </Pressable>

      <View style={styles.filtroRow}>
        {(['activa', 'todas'] as const).map(f => (
          <Pressable
            key={f}
            style={[styles.filtroBtn, filtro === f && styles.filtroActive]}
            onPress={() => setFiltro(f)}>
            <Text style={[styles.filtroText, filtro === f && styles.filtroTextActive]}>
              {f === 'activa' ? 'Activas' : 'Todas'}
            </Text>
          </Pressable>
        ))}
      </View>

      {cargando ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Brand.primary} />
        </View>
      ) : (
        <FlatList
          data={rifas}
          keyExtractor={r => r.id}
          renderItem={({ item }) => (
            <RifaCard rifa={item} onPress={() => router.push(`/rifa/${item.id}` as any)} />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="ticket-outline" size={48} color={Brand.onLightMuted} />
              <Text style={styles.emptyTitle}>
                {filtro === 'activa' ? 'No hay rifas activas' : 'No hay rifas'}
              </Text>
              {esAdmin && (
                <Text style={styles.emptyHint}>Creá la primera rifa con el botón de arriba</Text>
              )}
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Brand.cream,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  hello: {
    fontSize: 22,
    fontWeight: '800',
    color: Brand.onLight,
  },
  sub: {
    fontSize: 12,
    color: Brand.onLightMuted,
    marginTop: 2,
  },
  crearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Brand.primary,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  crearText: {
    color: Brand.white,
    fontWeight: '700',
    fontSize: 13,
  },
  filtroRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  filtroBtn: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#EAF1F0',
  },
  filtroActive: {
    backgroundColor: Brand.primary,
  },
  filtroText: {
    fontSize: 13,
    fontWeight: '600',
    color: Brand.onLightMuted,
  },
  filtroTextActive: {
    color: Brand.white,
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 14,
  },
  card: {
    backgroundColor: Brand.white,
    borderRadius: 18,
    padding: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: '#E7EEED',
    shadowColor: '#0A4D4A',
    shadowOpacity: 0.07,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Brand.onLight,
  },
  cardPremio: {
    fontSize: 13,
    color: Brand.onLightMuted,
    marginTop: 2,
  },
  estadoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  estadoDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  estadoText: {
    fontSize: 11,
    fontWeight: '700',
  },
  cardDesc: {
    fontSize: 13,
    color: Brand.onLightMuted,
    lineHeight: 19,
  },
  progressWrap: {
    gap: 6,
  },
  progressBar: {
    height: 7,
    borderRadius: 4,
    backgroundColor: '#E7EEED',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Brand.primary,
    borderRadius: 4,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressText: {
    fontSize: 12,
    color: Brand.onLightMuted,
  },
  disponiblesText: {
    fontSize: 12,
    color: Brand.success,
    fontWeight: '600',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#F0F4F3',
  },
  precioWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  precioText: {
    fontSize: 13,
    fontWeight: '700',
    color: Brand.primary,
  },
  verWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  verText: {
    fontSize: 13,
    fontWeight: '600',
    color: Brand.primary,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultadosBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 20, marginBottom: 10,
    backgroundColor: Brand.accent + '18', borderRadius: 12,
    paddingVertical: 10, paddingHorizontal: 14,
    borderWidth: 1, borderColor: Brand.accent + '40',
  },
  resultadosBtnText: { flex: 1, fontSize: 13, fontWeight: '700', color: '#B07D00' },
  empty: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Brand.onLightMuted,
  },
  emptyHint: {
    fontSize: 13,
    color: Brand.onLightMuted,
    textAlign: 'center',
  },
});
