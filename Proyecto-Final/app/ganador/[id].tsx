import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { db } from '@/config/firebase';
import { AppInfo, Brand } from '@/constants/brand';
import type { Rifa } from '@/types/rifa';

function formatearFecha(ts: any): string | null {
  const d = ts?.toDate?.();
  if (!d) return null;
  return d.toLocaleDateString('es-CR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function GanadorScreen() {
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

  const fecha = formatearFecha(rifa?.sorteado_en);

  function verPremio() {
    router.push(`/premio/${id}` as any);
  }

  if (cargando) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Brand.accent} />
      </View>
    );
  }

  if (!rifa || rifa.estado !== 'sorteada' || !rifa.ganador_numero) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]}>
        <Ionicons name="hourglass-outline" size={44} color={Brand.onDarkMuted} />
        <Text style={styles.pendiente}>Esta rifa aún no tiene ganador.</Text>
        <Pressable style={styles.btnVolver} onPress={() => router.back()}>
          <Text style={styles.btnVolverText}>Volver</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.contenido}>
        {/* Trofeo con glow dorado */}
        <View style={styles.glow3}>
          <View style={styles.glow2}>
            <View style={styles.trofeo}>
              <Ionicons name="trophy" size={60} color={Brand.white} />
            </View>
          </View>
        </View>

        <Text style={styles.ganadorLabel}>¡GANADOR!</Text>
        <Text style={styles.boletoNum}>Boleto #{rifa.ganador_numero}</Text>
        <Text style={styles.rifaTitulo}>{rifa.premio || rifa.titulo}</Text>

        {/* Tarjeta ganador */}
        <View style={styles.card}>
          <Text style={styles.ganadorNombre}>{rifa.ganador_nombre}</Text>
          <Text style={styles.ganadorZona}>{AppInfo.region}</Text>
          {fecha && <Text style={styles.ganadorFecha}>Sorteado el {fecha}</Text>}
        </View>

        {/* Botones */}
        <View style={[styles.acciones, { paddingBottom: insets.bottom + 20 }]}>
          <Pressable style={({ pressed }) => [styles.btnPremio, pressed && { opacity: 0.9 }]} onPress={verPremio}>
            <Text style={styles.btnPremioText}>Premio</Text>
          </Pressable>
          <Pressable style={({ pressed }) => [styles.btnVolver, pressed && { opacity: 0.9 }]} onPress={() => router.back()}>
            <Text style={styles.btnVolverText}>Volver</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.primaryDark },
  center: { alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 32 },
  pendiente: { fontSize: 15, color: Brand.onDarkMuted, textAlign: 'center' },

  contenido: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, gap: 6 },

  glow3: {
    width: 220, height: 220, borderRadius: 110, backgroundColor: Brand.accent + '14',
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  glow2: {
    width: 170, height: 170, borderRadius: 85, backgroundColor: Brand.accent + '26',
    alignItems: 'center', justifyContent: 'center',
  },
  trofeo: {
    width: 120, height: 120, borderRadius: 60, backgroundColor: Brand.accent,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Brand.accent, shadowOpacity: 0.6, shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 }, elevation: 10,
  },

  ganadorLabel: { fontSize: 30, fontWeight: '900', color: Brand.accent, letterSpacing: 1 },
  boletoNum: { fontSize: 40, fontWeight: '900', color: Brand.white, marginTop: 2 },
  rifaTitulo: { fontSize: 15, color: Brand.onDarkMuted, marginTop: 2 },

  card: {
    width: '100%', backgroundColor: Brand.white + '12', borderRadius: 18,
    borderWidth: 1, borderColor: Brand.white + '1A',
    paddingVertical: 18, paddingHorizontal: 20, alignItems: 'center', gap: 3, marginTop: 24,
  },
  ganadorNombre: { fontSize: 20, fontWeight: '800', color: Brand.white },
  ganadorZona: { fontSize: 13, color: Brand.onDarkMuted },
  ganadorFecha: { fontSize: 12, color: Brand.accent + 'CC', marginTop: 4 },

  acciones: { width: '100%', gap: 12, marginTop: 28 },
  btnPremio: {
    backgroundColor: Brand.accent, borderRadius: 16, height: 54,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Brand.accent, shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 6,
  },
  btnPremioText: { color: Brand.primaryDeep, fontSize: 16, fontWeight: '800' },
  btnVolver: {
    borderRadius: 16, height: 54, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: Brand.accent,
  },
  btnVolverText: { color: Brand.accent, fontSize: 15, fontWeight: '700' },
});
