import { Ionicons } from '@expo/vector-icons';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
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
import { useAuth } from '@/context/auth';
import type { Rifa } from '@/types/rifa';

const ESTADO_COLOR: Record<string, string> = {
  activa: Brand.success,
  cerrada: Brand.onLightMuted,
  sorteada: Brand.accent,
};
const ESTADO_LABEL: Record<string, string> = {
  activa: 'Activa',
  cerrada: 'Cerrada',
  sorteada: 'Sorteada',
};

type Stats = {
  totalRifas: number;
  rifasActivas: number;
  totalVendidos: number;
  ingresosBrutos: number;
};

export default function AdminScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { perfil } = useAuth();
  const [rifas, setRifas] = useState<Rifa[]>([]);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState<'todas' | 'activa' | 'cerrada' | 'sorteada'>('todas');

  useEffect(() => {
    const q = query(collection(db, 'rifas'), orderBy('creado_en', 'desc'));
    return onSnapshot(q, snap => {
      setRifas(snap.docs.map(d => ({ id: d.id, ...d.data() } as Rifa)));
      setCargando(false);
    }, () => setCargando(false));
  }, []);

  if (perfil?.rol !== 'admin') {
    return (
      <View style={[styles.root, { paddingTop: insets.top }, styles.center]}>
        <Ionicons name="lock-closed-outline" size={44} color={Brand.onLightMuted} />
        <Text style={styles.sinAcceso}>Acceso solo para administradores.</Text>
      </View>
    );
  }

  const stats: Stats = rifas.reduce<Stats>((acc, r) => ({
    totalRifas: acc.totalRifas + 1,
    rifasActivas: acc.rifasActivas + (r.estado === 'activa' ? 1 : 0),
    totalVendidos: acc.totalVendidos + (r.vendidos ?? 0),
    ingresosBrutos: acc.ingresosBrutos + (r.vendidos ?? 0) * (r.precio ?? 0),
  }), { totalRifas: 0, rifasActivas: 0, totalVendidos: 0, ingresosBrutos: 0 });

  const rifasFiltradas = filtro === 'todas' ? rifas : rifas.filter(r => r.estado === filtro);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.titulo}>Panel Admin</Text>
          <Text style={styles.sub}>Rifas Zona Sur</Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.crearBtn, pressed && { opacity: 0.85 }]}
          onPress={() => router.push('/crear-rifa')}>
          <Ionicons name="add" size={18} color={Brand.white} />
          <Text style={styles.crearText}>Nueva rifa</Text>
        </Pressable>
      </View>

      {/* Stats */}
      <View style={styles.statsGrid}>
        <StatCard icono="ticket" valor={stats.totalRifas} label="Rifas totales" color={Brand.primary} />
        <StatCard icono="radio-button-on" valor={stats.rifasActivas} label="Activas" color={Brand.success} />
        <StatCard icono="people" valor={stats.totalVendidos} label="Números vendidos" color="#6C63FF" />
        <StatCard
          icono="cash"
          valor={`₡${(stats.ingresosBrutos / 1000).toFixed(0)}k`}
          label="Ingresos brutos"
          color={Brand.accent}
          textValor
        />
      </View>

      {/* Filtros */}
      <View style={styles.filtroRow}>
        {(['todas', 'activa', 'cerrada', 'sorteada'] as const).map(f => (
          <Pressable
            key={f}
            style={[styles.filtroBtn, filtro === f && styles.filtroActive]}
            onPress={() => setFiltro(f)}>
            <Text style={[styles.filtroText, filtro === f && styles.filtroTextActive]}>
              {f === 'todas' ? 'Todas' : ESTADO_LABEL[f]}
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
          data={rifasFiltradas}
          keyExtractor={r => r.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="ticket-outline" size={44} color={Brand.onLightMuted} />
              <Text style={styles.emptyText}>No hay rifas en esta categoría</Text>
            </View>
          }
          renderItem={({ item: r }) => {
            const pct = r.total_numeros > 0 ? (r.vendidos ?? 0) / r.total_numeros : 0;
            const color = ESTADO_COLOR[r.estado] ?? Brand.onLightMuted;
            const ingresos = (r.vendidos ?? 0) * (r.precio ?? 0);

            return (
              <Pressable
                style={({ pressed }) => [styles.rifaCard, pressed && { opacity: 0.92 }]}
                onPress={() => router.push(`/admin-rifa/${r.id}` as any)}>

                <View style={styles.rifaCardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rifaTitulo} numberOfLines={1}>{r.titulo}</Text>
                    <Text style={styles.rifaPremio} numberOfLines={1}>🎁 {r.premio}</Text>
                  </View>
                  <View style={[styles.estadoBadge, { backgroundColor: color + '22', borderColor: color + '55' }]}>
                    <View style={[styles.estadoDot, { backgroundColor: color }]} />
                    <Text style={[styles.estadoText, { color }]}>{ESTADO_LABEL[r.estado]}</Text>
                  </View>
                </View>

                {/* Ganador si fue sorteada */}
                {r.estado === 'sorteada' && r.ganador_numero && (
                  <View style={styles.ganadorBanner}>
                    <Ionicons name="trophy" size={14} color={Brand.accent} />
                    <Text style={styles.ganadorText}>
                      Ganador: #{r.ganador_numero} — {r.ganador_nombre}
                    </Text>
                  </View>
                )}

                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${Math.round(pct * 100)}%` as any }]} />
                </View>

                <View style={styles.rifaFooter}>
                  <View style={styles.rifaStat}>
                    <Ionicons name="people-outline" size={13} color={Brand.onLightMuted} />
                    <Text style={styles.rifaStatText}>{r.vendidos ?? 0}/{r.total_numeros}</Text>
                  </View>
                  <View style={styles.rifaStat}>
                    <Ionicons name="cash-outline" size={13} color={Brand.success} />
                    <Text style={[styles.rifaStatText, { color: Brand.success, fontWeight: '700' }]}>
                      ₡{ingresos.toLocaleString('es-CR')}
                    </Text>
                  </View>
                  <View style={styles.verBtn}>
                    <Text style={styles.verText}>Gestionar</Text>
                    <Ionicons name="chevron-forward" size={13} color={Brand.primary} />
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

function StatCard({ icono, valor, label, color, textValor }: {
  icono: any; valor: number | string; label: string; color: string; textValor?: boolean;
}) {
  return (
    <View style={[styles.statCard, { borderColor: color + '30' }]}>
      <View style={[styles.statIcono, { backgroundColor: color + '18' }]}>
        <Ionicons name={icono} size={18} color={color} />
      </View>
      <Text style={[styles.statValor, { color }]}>{valor}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.cream },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  sinAcceso: { fontSize: 15, color: Brand.onLightMuted, textAlign: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
  },
  titulo: { fontSize: 22, fontWeight: '800', color: Brand.onLight },
  sub: { fontSize: 12, color: Brand.onLightMuted, marginTop: 2 },
  crearBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Brand.primary, paddingVertical: 9, paddingHorizontal: 14, borderRadius: 12,
  },
  crearText: { color: Brand.white, fontWeight: '700', fontSize: 13 },

  // Stats grid 2x2
  statsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
    paddingHorizontal: 20, marginBottom: 14,
  },
  statCard: {
    width: '47%', backgroundColor: Brand.white, borderRadius: 16, padding: 14,
    gap: 6, borderWidth: 1,
    shadowColor: '#0A4D4A', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  statIcono: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  statValor: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 11, color: Brand.onLightMuted, fontWeight: '600' },

  // Filtros
  filtroRow: {
    flexDirection: 'row', gap: 7, paddingHorizontal: 20, marginBottom: 12, flexWrap: 'wrap',
  },
  filtroBtn: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 20, backgroundColor: '#EAF1F0' },
  filtroActive: { backgroundColor: Brand.primary },
  filtroText: { fontSize: 12, fontWeight: '600', color: Brand.onLightMuted },
  filtroTextActive: { color: Brand.white },

  list: { paddingHorizontal: 20, paddingBottom: 24, gap: 12 },
  empty: { alignItems: 'center', paddingTop: 48, gap: 10 },
  emptyText: { fontSize: 15, color: Brand.onLightMuted },

  // Rifa card
  rifaCard: {
    backgroundColor: Brand.white, borderRadius: 18, padding: 16, gap: 10,
    borderWidth: 1, borderColor: '#E7EEED',
    shadowColor: '#0A4D4A', shadowOpacity: 0.06, shadowRadius: 10, elevation: 2,
  },
  rifaCardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  rifaTitulo: { fontSize: 15, fontWeight: '800', color: Brand.onLight },
  rifaPremio: { fontSize: 12, color: Brand.onLightMuted, marginTop: 2 },
  estadoBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingVertical: 4, paddingHorizontal: 10, borderRadius: 20, borderWidth: 1,
  },
  estadoDot: { width: 7, height: 7, borderRadius: 4 },
  estadoText: { fontSize: 11, fontWeight: '700' },
  ganadorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: Brand.accent + '18', borderRadius: 10, padding: 8,
  },
  ganadorText: { fontSize: 13, color: Brand.primaryDark, fontWeight: '600', flex: 1 },
  progressBar: { height: 6, borderRadius: 3, backgroundColor: '#E7EEED', overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Brand.primary, borderRadius: 3 },
  rifaFooter: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderTopWidth: 1, borderTopColor: '#F0F4F3', paddingTop: 8,
  },
  rifaStat: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  rifaStatText: { fontSize: 13, color: Brand.onLightMuted },
  verBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  verText: { fontSize: 13, fontWeight: '700', color: Brand.primary },
});
