import { Ionicons } from '@expo/vector-icons';
import { collection, collectionGroup, getDocs, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
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
import type { NumeroDoc, Rifa } from '@/types/rifa';

type NumeroConId = NumeroDoc & { numero: string; rifa_id: string };
type RifaGanada = Rifa & { miNumero: string };

export default function MisNumerosScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [numeros, setNumeros] = useState<NumeroConId[]>([]);
  const [rifasGanadas, setRifasGanadas] = useState<RifaGanada[]>([]);
  const [cargando, setCargando] = useState(true);

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

      // Detectar rifas ganadas: rifas sorteadas donde ganador_uid == user.uid
      try {
        const rifasSnap = await getDocs(
          query(collection(db, 'rifas'), where('estado', '==', 'sorteada'), where('ganador_uid', '==', user.uid))
        );
        const ganadas = rifasSnap.docs.map(d => {
          const rifa = { id: d.id, ...d.data() } as Rifa;
          const miNumero = rifa.ganador_numero ?? '';
          return { ...rifa, miNumero };
        });
        setRifasGanadas(ganadas);
      } catch { /* silencioso */ }
    }, (err) => {
      console.error('Error en Mis Números:', err.message, err);
      setCargando(false);
    });

    return unsub;
  }, [user]);

  // Agrupar por rifa
  const porRifa = numeros.reduce<Record<string, NumeroConId[]>>((acc, n) => {
    const key = `${n.rifa_id}||${n.rifa_titulo}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(n);
    return acc;
  }, {});

  const grupos = Object.entries(porRifa).map(([key, nums]) => {
    const [rifa_id, rifa_titulo] = key.split('||');
    return { rifa_id, rifa_titulo, numeros: nums };
  });

  if (cargando) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }, styles.center]}>
        <ActivityIndicator size="large" color={Brand.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.titulo}>Mis Números</Text>
        <Text style={styles.sub}>{numeros.length} número{numeros.length !== 1 ? 's' : ''} comprado{numeros.length !== 1 ? 's' : ''}</Text>
      </View>

      {/* Banners de rifas ganadas */}
      {rifasGanadas.map(r => (
        <Pressable
          key={r.id}
          style={({ pressed }) => [styles.ganadoBanner, pressed && { opacity: 0.92 }]}
          onPress={() => router.push(`/rifa/${r.id}` as any)}>
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

      {grupos.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="receipt-outline" size={52} color={Brand.onLightMuted} />
          <Text style={styles.emptyTitle}>Todavía no compraste números</Text>
          <Text style={styles.emptyHint}>Explorá las rifas activas y elegí tus números</Text>
          <Pressable
            style={({ pressed }) => [styles.irBtn, pressed && { opacity: 0.85 }]}
            onPress={() => router.push('/(tabs)')}>
            <Text style={styles.irBtnText}>Ver rifas</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={grupos}
          keyExtractor={g => g.rifa_id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item: grupo }) => (
            <Pressable
              style={({ pressed }) => [styles.grupoCard, pressed && { opacity: 0.92 }]}
              onPress={() => router.push(`/rifa/${grupo.rifa_id}` as any)}>
              <View style={styles.grupoHeader}>
                <Ionicons name="ticket" size={16} color={Brand.primary} />
                <Text style={styles.grupoTitulo} numberOfLines={1}>{grupo.rifa_titulo}</Text>
                <Ionicons name="chevron-forward" size={14} color={Brand.onLightMuted} />
              </View>
              <View style={styles.numerosWrap}>
                {grupo.numeros.map(n => (
                  <View
                    key={n.numero}
                    style={[styles.numeroBadge, n.pagado ? styles.numeroPagado : styles.numeroPendiente]}>
                    <Text style={[styles.numeroText, n.pagado ? styles.numeroTextPagado : styles.numeroTextPendiente]}>
                      #{n.numero}
                    </Text>
                  </View>
                ))}
              </View>
              <View style={styles.grupoFooter}>
                <Text style={styles.grupoResumen}>
                  {grupo.numeros.filter(n => n.pagado).length} pagado{grupo.numeros.filter(n => n.pagado).length !== 1 ? 's' : ''}
                  {'  ·  '}
                  {grupo.numeros.filter(n => !n.pagado).length} pendiente{grupo.numeros.filter(n => !n.pagado).length !== 1 ? 's' : ''}
                </Text>
              </View>
            </Pressable>
          )}
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
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  titulo: {
    fontSize: 22,
    fontWeight: '800',
    color: Brand.onLight,
  },
  sub: {
    fontSize: 12,
    color: Brand.onLightMuted,
    marginTop: 2,
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 14,
  },
  grupoCard: {
    backgroundColor: Brand.white,
    borderRadius: 18,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#E7EEED',
    shadowColor: '#0A4D4A',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  grupoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  grupoTitulo: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: Brand.onLight,
  },
  numerosWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  numeroBadge: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  numeroPagado: {
    backgroundColor: Brand.success + '18',
    borderColor: Brand.success + '60',
  },
  numeroPendiente: {
    backgroundColor: Brand.accent + '18',
    borderColor: Brand.accent + '70',
  },
  numeroText: {
    fontSize: 13,
    fontWeight: '700',
  },
  numeroTextPagado: {
    color: Brand.success,
  },
  numeroTextPendiente: {
    color: '#B07D00',
  },
  grupoFooter: {
    borderTopWidth: 1,
    borderTopColor: '#F0F4F3',
    paddingTop: 8,
  },
  grupoResumen: {
    fontSize: 12,
    color: Brand.onLightMuted,
  },
  ganadoBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 20, marginBottom: 12,
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
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Brand.onLight,
    textAlign: 'center',
  },
  emptyHint: {
    fontSize: 13,
    color: Brand.onLightMuted,
    textAlign: 'center',
    lineHeight: 19,
  },
  irBtn: {
    marginTop: 8,
    backgroundColor: Brand.primary,
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 14,
  },
  irBtnText: {
    color: Brand.white,
    fontWeight: '700',
    fontSize: 15,
  },
});
