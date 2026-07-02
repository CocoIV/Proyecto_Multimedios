import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { db } from '@/config/firebase';
import { Brand } from '@/constants/brand';
import { REGION } from '@/constants/zonas';
import type { NumeroDoc, Rifa } from '@/types/rifa';

/** ID legible del boleto: código de zona (ej. GOL para Golfito) + número. */
function ticketId(zona: string | undefined, numero: string) {
  const year = new Date().getFullYear();
  const code = (zona ?? '').replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase() || 'CR';
  return `TOM-${year}-${code}-${numero.padStart(3, '0')}`;
}

function formatearFecha(ts: any): string | null {
  const d = ts?.toDate?.();
  if (!d) return null;
  return d.toLocaleDateString('es-CR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function DetalleBoletoScreen() {
  const { rifa: rifaId, numero } = useLocalSearchParams<{ rifa: string; numero: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [rifa, setRifa] = useState<Rifa | null>(null);
  const [boleto, setBoleto] = useState<NumeroDoc | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!rifaId || !numero) return;
    const unsubRifa = onSnapshot(doc(db, 'rifas', rifaId), snap => {
      if (snap.exists()) setRifa({ id: snap.id, ...snap.data() } as Rifa);
    });
    const unsubNum = onSnapshot(doc(db, 'rifas', rifaId, 'numeros', numero), snap => {
      if (snap.exists()) setBoleto(snap.data() as NumeroDoc);
      setCargando(false);
    });
    return () => { unsubRifa(); unsubNum(); };
  }, [rifaId, numero]);

  const id = ticketId(rifa?.zona, numero ?? '');
  const fecha = formatearFecha(rifa?.fecha_sorteo) ?? formatearFecha(rifa?.sorteado_en);
  const zonaLinea = rifa?.zona ? `${rifa.zona} · ${REGION}` : REGION;
  const qrValue = `TOMBOLITAS|${id}|rifa=${rifaId}|n=${numero}`;

  function descargar() {
    const msg = 'Mostrá este código QR cuando recibas tu premio. Podés hacer una captura de pantalla para guardarlo.';
    if (Platform.OS === 'web') window.alert(msg);
    else Alert.alert('Tu boleto', msg);
  }

  return (
    <View style={styles.root}>
      {/* NavBar */}
      <View style={[styles.navBar, { paddingTop: insets.top + 6 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Brand.white} />
        </Pressable>
        <Text style={styles.navTitulo}>Detalle del Boleto</Text>
        <View style={{ width: 40 }} />
      </View>

      {cargando ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Brand.accent} />
        </View>
      ) : (
        <View style={styles.contenido}>
          {/* Tarjeta boleto */}
          <View style={styles.card}>
            {/* Franja verde con premio */}
            <View style={styles.franja}>
              <Text style={styles.franjaTitulo} numberOfLines={1}>{rifa?.premio ?? rifa?.titulo ?? 'Rifa'}</Text>
              <Text style={styles.franjaSub}>
                {zonaLinea}{fecha ? ` · Sorteo ${fecha}` : ''}
              </Text>
            </View>

            <View style={styles.cardBody}>
              <Text style={styles.numeroLabel}>NÚMERO DE BOLETO</Text>
              <Text style={styles.numeroGrande}>#{numero}</Text>

              {/* QR */}
              <View style={styles.qrWrap}>
                <QRCode
                  value={qrValue}
                  size={150}
                  color={Brand.onLight}
                  backgroundColor={Brand.white}
                />
              </View>

              <Text style={styles.ticketId}>ID: {id}</Text>
              <Text style={styles.nota}>
                En caso de ganar, al recibir su premio deberá mostrar este mismo QR.
              </Text>

              {boleto && (
                <View style={styles.compradorRow}>
                  <Ionicons name="person-circle-outline" size={16} color={Brand.onLightMuted} />
                  <Text style={styles.compradorText}>{boleto.comprador_nombre}</Text>
                  {boleto.pagado && (
                    <View style={styles.pagadoBadge}>
                      <Ionicons name="checkmark-circle" size={12} color={Brand.success} />
                      <Text style={styles.pagadoText}>Pagado</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          </View>

          {/* Botones */}
          <View style={[styles.acciones, { paddingBottom: insets.bottom + 16 }]}>
            <Pressable style={({ pressed }) => [styles.btnDescargar, pressed && { opacity: 0.9 }]} onPress={descargar}>
              <Text style={styles.btnDescargarText}>Descargar boleto</Text>
            </Pressable>
            <Pressable style={({ pressed }) => [styles.btnVolver, pressed && { opacity: 0.9 }]} onPress={() => router.back()}>
              <Text style={styles.btnVolverText}>volver</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.cream },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  navBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 14,
    backgroundColor: Brand.primaryDark,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: Brand.white + '1A',
    alignItems: 'center', justifyContent: 'center',
  },
  navTitulo: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '800', color: Brand.white, marginHorizontal: 8 },

  contenido: { flex: 1, paddingHorizontal: 20, paddingTop: 12, justifyContent: 'space-between' },

  card: {
    backgroundColor: Brand.white, borderRadius: 22, overflow: 'hidden',
    marginTop: 8,
    borderWidth: 1, borderColor: Brand.onLight + '10',
    shadowColor: Brand.onLight, shadowOpacity: 0.08, shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 }, elevation: 4,
  },
  franja: {
    backgroundColor: Brand.primaryDark, paddingVertical: 14, paddingHorizontal: 18,
    alignItems: 'center', gap: 2,
  },
  franjaTitulo: { color: Brand.white, fontSize: 17, fontWeight: '800' },
  franjaSub: { color: Brand.onDarkMuted, fontSize: 12 },

  cardBody: { alignItems: 'center', paddingVertical: 22, paddingHorizontal: 20, gap: 10 },
  numeroLabel: { fontSize: 11, fontWeight: '700', color: Brand.onLightMuted, letterSpacing: 1.5 },
  numeroGrande: { fontSize: 52, fontWeight: '900', color: Brand.onLight, letterSpacing: 1 },
  qrWrap: {
    padding: 12, backgroundColor: Brand.white, borderRadius: 14,
    borderWidth: 1, borderColor: Brand.onLight + '12', marginTop: 4,
  },
  ticketId: { fontSize: 13, fontWeight: '700', color: Brand.onLight, marginTop: 6 },
  nota: { fontSize: 12, color: Brand.onLightMuted, textAlign: 'center', lineHeight: 17, paddingHorizontal: 10 },
  compradorRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4,
    borderTopWidth: 1, borderTopColor: Brand.onLight + '0F', paddingTop: 12, width: '100%', justifyContent: 'center',
  },
  compradorText: { fontSize: 13, color: Brand.onLight, fontWeight: '600' },
  pagadoBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: Brand.success + '18', borderRadius: 10, paddingVertical: 2, paddingHorizontal: 8,
  },
  pagadoText: { fontSize: 11, fontWeight: '700', color: Brand.success },

  acciones: { gap: 12 },
  btnDescargar: {
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Brand.primaryDark, borderRadius: 16, height: 54,
  },
  btnDescargarText: { color: Brand.white, fontSize: 16, fontWeight: '700' },
  btnVolver: {
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Brand.cream, borderRadius: 16, height: 54,
    borderWidth: 1.5, borderColor: Brand.primary,
  },
  btnVolverText: { color: Brand.primary, fontSize: 15, fontWeight: '700' },
});
