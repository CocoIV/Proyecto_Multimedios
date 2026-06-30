import { Ionicons } from '@expo/vector-icons';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { db } from '@/config/firebase';
import { Brand } from '@/constants/brand';
import { useAuth } from '@/context/auth';
import type { NumeroDoc, Rifa } from '@/types/rifa';

type NumeroConId = NumeroDoc & { numero: string };
type EstadoNumero = 'libre' | 'mio' | 'ocupado';

export default function RifaDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, perfil } = useAuth();

  const [rifa, setRifa] = useState<Rifa | null>(null);
  const [numerosVendidos, setNumerosVendidos] = useState<NumeroConId[]>([]);
  const [cargando, setCargando] = useState(true);

  // Estado del modal de compra
  const [modalVisible, setModalVisible] = useState(false);
  const [numeroSeleccionado, setNumeroSeleccionado] = useState<number | null>(null);
  const [compradorNombre, setCompradorNombre] = useState('');
  const [compradorTelefono, setCompradorTelefono] = useState('');
  const [comprando, setComprando] = useState(false);
  // Pago simulado
  const [paso, setPaso] = useState<1 | 2 | 3 | 4>(1); // 1=datos, 2=tarjeta, 3=procesando, 4=éxito
  const [tarjetaNum, setTarjetaNum] = useState('');
  const [tarjetaExp, setTarjetaExp] = useState('');
  const [tarjetaCvv, setTarjetaCvv] = useState('');
  const [tarjetaNombre, setTarjetaNombre] = useState('');

  useEffect(() => {
    if (!id) return;
    const rifaRef = doc(db, 'rifas', id);
    const numRef = collection(db, 'rifas', id, 'numeros');

    const unsubRifa = onSnapshot(rifaRef, snap => {
      if (snap.exists()) setRifa({ id: snap.id, ...snap.data() } as Rifa);
      setCargando(false);
    });

    const unsubNum = onSnapshot(numRef, snap => {
      setNumerosVendidos(snap.docs.map(d => ({ ...(d.data() as NumeroDoc), numero: d.id })));
    });

    return () => { unsubRifa(); unsubNum(); };
  }, [id]);

  // Pre-rellenar nombre y teléfono del perfil
  useEffect(() => {
    setCompradorNombre(perfil?.nombre ?? user?.displayName ?? '');
    setCompradorTelefono(perfil?.telefono ?? '');
  }, [perfil, user]);

  function estadoNumero(n: number): EstadoNumero {
    const vendido = numerosVendidos.find(v => v.numero === String(n));
    if (!vendido) return 'libre';
    if (vendido.comprador_uid === user?.uid) return 'mio';
    return 'ocupado';
  }

  function abrirModal(n: number) {
    if (rifa?.estado !== 'activa') return;
    if (estadoNumero(n) !== 'libre') return;
    setNumeroSeleccionado(n);
    setPaso(1);
    setTarjetaNum(''); setTarjetaExp(''); setTarjetaCvv(''); setTarjetaNombre('');
    setModalVisible(true);
  }

  function cerrarModal() {
    if (comprando) return;
    setModalVisible(false);
  }

  function avanzarAPago() {
    if (!compradorNombre.trim()) {
      if (Platform.OS === 'web') { window.alert('Ingresá tu nombre.'); return; }
      Alert.alert('Falta nombre', 'Ingresá tu nombre.'); return;
    }
    if (!compradorTelefono.trim()) {
      if (Platform.OS === 'web') { window.alert('Ingresá tu teléfono.'); return; }
      Alert.alert('Falta teléfono', 'Ingresá tu número de teléfono.'); return;
    }
    setPaso(2);
  }

  function formatearTarjeta(v: string) {
    const solo = v.replace(/\D/g, '').slice(0, 16);
    return solo.replace(/(.{4})/g, '$1 ').trim();
  }

  function formatearExpiry(v: string) {
    const solo = v.replace(/\D/g, '').slice(0, 4);
    if (solo.length >= 3) return `${solo.slice(0, 2)}/${solo.slice(2)}`;
    return solo;
  }

  async function procesarPago() {
    const numLimpio = tarjetaNum.replace(/\s/g, '');
    if (numLimpio.length < 16) {
      if (Platform.OS === 'web') { window.alert('Ingresá un número de tarjeta válido (16 dígitos).'); return; }
      Alert.alert('Tarjeta inválida', 'Ingresá un número de tarjeta válido.'); return;
    }
    if (tarjetaExp.length < 5) {
      if (Platform.OS === 'web') { window.alert('Ingresá la fecha de vencimiento (MM/AA).'); return; }
      Alert.alert('Fecha inválida', 'Ingresá la fecha de vencimiento.'); return;
    }
    if (tarjetaCvv.length < 3) {
      if (Platform.OS === 'web') { window.alert('Ingresá el CVV (3 dígitos).'); return; }
      Alert.alert('CVV inválido', 'Ingresá el CVV.'); return;
    }

    setPaso(3);
    setComprando(true);

    // Simular procesamiento de 2.5 segundos
    await new Promise(r => setTimeout(r, 2500));

    try {
      const numeroRef = doc(db, 'rifas', id!, 'numeros', String(numeroSeleccionado));
      const rifaRef = doc(db, 'rifas', id!);

      await runTransaction(db, async (tx) => {
        const snap = await tx.get(numeroRef);
        if (snap.exists()) throw new Error('ocupado');

        const rifaSnap = await tx.get(rifaRef);
        if (!rifaSnap.exists()) throw new Error('no-rifa');

        tx.set(numeroRef, {
          comprador_uid: user!.uid,
          comprador_nombre: compradorNombre.trim(),
          comprador_telefono: compradorTelefono.trim(),
          comprado_en: serverTimestamp(),
          pagado: true,
          rifa_titulo: rifa?.titulo ?? '',
        });

        tx.update(rifaRef, { vendidos: (rifaSnap.data().vendidos ?? 0) + 1 });
      });

      setPaso(4);
    } catch (e: any) {
      setComprando(false);
      setPaso(2);
      const msg = e.message === 'ocupado'
        ? 'Alguien acaba de comprar ese número. Elegí otro.'
        : 'No se pudo procesar el pago. Intentá de nuevo.';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Error', msg);
    } finally {
      setComprando(false);
    }
  }

  if (cargando) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }, styles.center]}>
        <ActivityIndicator size="large" color={Brand.primary} />
      </View>
    );
  }

  if (!rifa) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }, styles.center]}>
        <Text style={styles.errorText}>Rifa no encontrada.</Text>
      </View>
    );
  }

  const pct = rifa.total_numeros > 0 ? rifa.vendidos / rifa.total_numeros : 0;
  const numeros = Array.from({ length: rifa.total_numeros }, (_, i) => i + 1);
  const esActiva = rifa.estado === 'activa';
  const esAdmin = perfil?.rol === 'admin';

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* NavBar */}
      <View style={styles.navBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Brand.onLight} />
        </Pressable>
        <Text style={styles.navTitulo} numberOfLines={1}>{rifa.titulo}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Info de la rifa */}
        <View style={styles.infoCard}>
          <Text style={styles.premioLabel}>Premio</Text>
          <Text style={styles.premioText}>🎁 {rifa.premio}</Text>
          {rifa.descripcion ? <Text style={styles.desc}>{rifa.descripcion}</Text> : null}

          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statVal}>₡{(rifa.precio ?? 0).toLocaleString('es-CR')}</Text>
              <Text style={styles.statLabel}>por número</Text>
            </View>
            <View style={styles.statDiv} />
            <View style={styles.stat}>
              <Text style={styles.statVal}>{rifa.total_numeros - rifa.vendidos}</Text>
              <Text style={styles.statLabel}>disponibles</Text>
            </View>
            <View style={styles.statDiv} />
            <View style={styles.stat}>
              <Text style={styles.statVal}>{rifa.vendidos}</Text>
              <Text style={styles.statLabel}>vendidos</Text>
            </View>
          </View>

          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${Math.round(pct * 100)}%` as any }]} />
          </View>
          <Text style={styles.progressPct}>{Math.round(pct * 100)}% vendido</Text>
        </View>

        {/* Banner ganador — visible para todos cuando la rifa fue sorteada */}
        {rifa.estado === 'sorteada' && rifa.ganador_numero && (
          <View style={styles.ganadorBanner}>
            <View style={styles.ganadorBannerTop}>
              <Ionicons name="trophy" size={26} color={Brand.white} />
              <Text style={styles.ganadorBannerTitulo}>¡Tenemos ganador!</Text>
            </View>
            <View style={styles.ganadorBannerBody}>
              <View style={styles.ganadorNumeroCircle}>
                <Text style={styles.ganadorNumeroLabel}>N°</Text>
                <Text style={styles.ganadorNumeroVal}>{rifa.ganador_numero}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.ganadorBannerNombre}>{rifa.ganador_nombre}</Text>
                <Text style={styles.ganadorBannerTel}>{rifa.ganador_telefono}</Text>
                {rifa.sorteado_en && (
                  <Text style={styles.ganadorBannerFecha}>
                    {(rifa.sorteado_en as any).toDate?.().toLocaleDateString('es-CR', {
                      day: 'numeric', month: 'long', year: 'numeric',
                    })}
                  </Text>
                )}
              </View>
            </View>
            {/* Resaltar si el usuario actual es el ganador */}
            {rifa.ganador_uid === user?.uid && (
              <View style={styles.tuGanasteBanner}>
                <Ionicons name="star" size={16} color={Brand.accent} />
                <Text style={styles.tuGanasteText}>¡Sos el ganador! Contactá al organizador.</Text>
              </View>
            )}
          </View>
        )}

        {/* Leyenda */}
        <View style={styles.leyenda}>
          <LeyendaItem color={Brand.white} border="#D0DAD8" label="Disponible" />
          <LeyendaItem color={Brand.primary} label="Tuyo" />
          <LeyendaItem color="#C8D8D6" label="Ocupado" />
        </View>

        {/* Grilla de números */}
        <View style={styles.grillaWrap}>
          <View style={styles.grilla}>
            {numeros.map(n => {
              const estado = estadoNumero(n);
              return (
                <Pressable
                  key={n}
                  style={[
                    styles.numBtn,
                    estado === 'mio' && styles.numBtnMio,
                    estado === 'ocupado' && styles.numBtnOcupado,
                    (!esActiva || estado !== 'libre') && styles.numBtnDisabled,
                  ]}
                  onPress={() => abrirModal(n)}
                  disabled={!esActiva || estado !== 'libre'}>
                  <Text style={[
                    styles.numText,
                    estado === 'mio' && styles.numTextMio,
                    estado === 'ocupado' && styles.numTextOcupado,
                  ]}>
                    {n}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {!esActiva && (
          <View style={styles.cerradaBanner}>
            <Ionicons name="lock-closed-outline" size={16} color={Brand.onLightMuted} />
            <Text style={styles.cerradaText}>
              Esta rifa está {rifa.estado === 'sorteada' ? 'sorteada' : 'cerrada'} — ya no se pueden comprar números.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Modal de compra */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={cerrarModal}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={[styles.modalCard, { paddingBottom: insets.bottom + 16 }]}>

            {/* PASO 1: Datos personales */}
            {paso === 1 && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitulo}>Número #{numeroSeleccionado}</Text>
                  <Pressable onPress={cerrarModal} style={styles.modalClose}>
                    <Ionicons name="close" size={20} color={Brand.onLightMuted} />
                  </Pressable>
                </View>
                <Text style={styles.modalPrecio}>₡{(rifa.precio ?? 0).toLocaleString('es-CR')} · Pago con tarjeta</Text>
                <View style={styles.modalCampo}>
                  <Text style={styles.modalLabel}>Nombre completo</Text>
                  <TextInput style={styles.modalInput} value={compradorNombre} onChangeText={setCompradorNombre}
                    placeholder="Tu nombre" placeholderTextColor={Brand.onLightMuted} autoCapitalize="words" />
                </View>
                <View style={styles.modalCampo}>
                  <Text style={styles.modalLabel}>Teléfono</Text>
                  <TextInput style={styles.modalInput} value={compradorTelefono} onChangeText={setCompradorTelefono}
                    placeholder="Ej: 8888-8888" placeholderTextColor={Brand.onLightMuted} keyboardType="phone-pad" />
                </View>
                <Pressable style={({ pressed }) => [styles.comprarBtn, pressed && { opacity: 0.88 }]} onPress={avanzarAPago}>
                  <Text style={styles.comprarBtnText}>Continuar al pago</Text>
                  <Ionicons name="arrow-forward" size={18} color={Brand.white} />
                </Pressable>
              </>
            )}

            {/* PASO 2: Datos de tarjeta */}
            {paso === 2 && (
              <>
                <View style={styles.modalHeader}>
                  <Pressable onPress={() => setPaso(1)} style={styles.modalClose}>
                    <Ionicons name="arrow-back" size={20} color={Brand.onLightMuted} />
                  </Pressable>
                  <Text style={styles.modalTitulo}>Datos de pago</Text>
                  <Pressable onPress={cerrarModal} style={styles.modalClose}>
                    <Ionicons name="close" size={20} color={Brand.onLightMuted} />
                  </Pressable>
                </View>

                {/* Tarjeta visual */}
                <View style={styles.tarjetaVisual}>
                  <View style={styles.tarjetaChip}>
                    <Ionicons name="card" size={22} color={Brand.accent} />
                  </View>
                  <Text style={styles.tarjetaNumVisual}>
                    {tarjetaNum || '•••• •••• •••• ••••'}
                  </Text>
                  <View style={styles.tarjetaRow}>
                    <View>
                      <Text style={styles.tarjetaSubLabel}>TITULAR</Text>
                      <Text style={styles.tarjetaSubVal}>{tarjetaNombre || '—'}</Text>
                    </View>
                    <View>
                      <Text style={styles.tarjetaSubLabel}>VENCE</Text>
                      <Text style={styles.tarjetaSubVal}>{tarjetaExp || 'MM/AA'}</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.modalCampo}>
                  <Text style={styles.modalLabel}>Número de tarjeta</Text>
                  <TextInput style={styles.modalInput} value={tarjetaNum}
                    onChangeText={v => setTarjetaNum(formatearTarjeta(v))}
                    placeholder="1234 5678 9012 3456" placeholderTextColor={Brand.onLightMuted}
                    keyboardType="numeric" maxLength={19} />
                </View>
                <View style={styles.modalCampo}>
                  <Text style={styles.modalLabel}>Nombre en la tarjeta</Text>
                  <TextInput style={styles.modalInput} value={tarjetaNombre} onChangeText={setTarjetaNombre}
                    placeholder="NOMBRE APELLIDO" placeholderTextColor={Brand.onLightMuted} autoCapitalize="characters" />
                </View>
                <View style={styles.modalRow}>
                  <View style={[styles.modalCampo, { flex: 1 }]}>
                    <Text style={styles.modalLabel}>Vencimiento</Text>
                    <TextInput style={styles.modalInput} value={tarjetaExp}
                      onChangeText={v => setTarjetaExp(formatearExpiry(v))}
                      placeholder="MM/AA" placeholderTextColor={Brand.onLightMuted}
                      keyboardType="numeric" maxLength={5} />
                  </View>
                  <View style={[styles.modalCampo, { flex: 1 }]}>
                    <Text style={styles.modalLabel}>CVV</Text>
                    <TextInput style={styles.modalInput} value={tarjetaCvv}
                      onChangeText={v => setTarjetaCvv(v.replace(/\D/g, '').slice(0, 4))}
                      placeholder="123" placeholderTextColor={Brand.onLightMuted}
                      keyboardType="numeric" secureTextEntry maxLength={4} />
                  </View>
                </View>

                <View style={styles.seguridadWrap}>
                  <Ionicons name="lock-closed" size={13} color={Brand.success} />
                  <Text style={styles.seguridadText}>Pago seguro simulado · Solo para demostración</Text>
                </View>

                <Pressable style={({ pressed }) => [styles.comprarBtn, pressed && { opacity: 0.88 }]} onPress={procesarPago}>
                  <Ionicons name="card-outline" size={18} color={Brand.white} />
                  <Text style={styles.comprarBtnText}>Pagar ₡{(rifa.precio ?? 0).toLocaleString('es-CR')}</Text>
                </Pressable>
              </>
            )}

            {/* PASO 3: Procesando */}
            {paso === 3 && (
              <View style={styles.procesandoWrap}>
                <ActivityIndicator size="large" color={Brand.primary} />
                <Text style={styles.procesandoTitulo}>Procesando pago…</Text>
                <Text style={styles.procesandoSub}>No cerrés esta ventana</Text>
              </View>
            )}

            {/* PASO 4: Éxito */}
            {paso === 4 && (
              <View style={styles.exitoWrap}>
                <View style={styles.exitoIcono}>
                  <Ionicons name="checkmark" size={40} color={Brand.white} />
                </View>
                <Text style={styles.exitoTitulo}>¡Pago confirmado!</Text>
                <Text style={styles.exitoSub}>
                  El número <Text style={{ fontWeight: '800' }}>#{numeroSeleccionado}</Text> es tuyo.{'\n'}
                  ¡Buena suerte en el sorteo!
                </Text>
                <Pressable
                  style={({ pressed }) => [styles.comprarBtn, { marginTop: 8 }, pressed && { opacity: 0.88 }]}
                  onPress={() => setModalVisible(false)}>
                  <Text style={styles.comprarBtnText}>Ver mi número</Text>
                </Pressable>
              </View>
            )}

          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function LeyendaItem({ color, border, label }: { color: string; border?: string; label: string }) {
  return (
    <View style={styles.leyendaItem}>
      <View style={[styles.leyendaColor, { backgroundColor: color, borderColor: border ?? color, borderWidth: border ? 1.5 : 0 }]} />
      <Text style={styles.leyendaText}>{label}</Text>
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
  errorText: {
    fontSize: 15,
    color: Brand.onLightMuted,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Brand.white,
    borderBottomWidth: 1,
    borderBottomColor: '#E7EEED',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F0F4F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitulo: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    color: Brand.onLight,
    marginHorizontal: 8,
  },
  infoCard: {
    margin: 16,
    backgroundColor: Brand.white,
    borderRadius: 18,
    padding: 18,
    gap: 10,
    borderWidth: 1,
    borderColor: '#E7EEED',
  },
  premioLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Brand.onLightMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  premioText: {
    fontSize: 18,
    fontWeight: '800',
    color: Brand.onLight,
  },
  desc: {
    fontSize: 13,
    color: Brand.onLightMuted,
    lineHeight: 19,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#F0F4F3',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F4F3',
  },
  stat: {
    alignItems: 'center',
    gap: 2,
  },
  statVal: {
    fontSize: 17,
    fontWeight: '800',
    color: Brand.onLight,
  },
  statLabel: {
    fontSize: 11,
    color: Brand.onLightMuted,
  },
  statDiv: {
    width: 1,
    backgroundColor: '#E7EEED',
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E7EEED',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Brand.primary,
    borderRadius: 4,
  },
  progressPct: {
    fontSize: 12,
    color: Brand.onLightMuted,
    textAlign: 'right',
  },
  leyenda: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  leyendaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  leyendaColor: {
    width: 16,
    height: 16,
    borderRadius: 5,
  },
  leyendaText: {
    fontSize: 12,
    color: Brand.onLightMuted,
  },
  grillaWrap: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  grilla: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'center',
  },
  numBtn: {
    width: 50,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Brand.white,
    borderWidth: 1.5,
    borderColor: '#D0DAD8',
  },
  numBtnMio: {
    backgroundColor: Brand.primary,
    borderColor: Brand.primary,
  },
  numBtnOcupado: {
    backgroundColor: '#C8D8D6',
    borderColor: '#B0C4C2',
  },
  numBtnDisabled: {
    opacity: 0.85,
  },
  numText: {
    fontSize: 13,
    fontWeight: '700',
    color: Brand.onLight,
  },
  numTextMio: {
    color: Brand.white,
  },
  numTextOcupado: {
    color: Brand.onLightMuted,
  },
  // Banner ganador público
  ganadorBanner: {
    marginHorizontal: 16, marginBottom: 12, borderRadius: 18, overflow: 'hidden',
    backgroundColor: Brand.primaryDark,
  },
  ganadorBannerTop: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Brand.accent, paddingHorizontal: 16, paddingVertical: 10,
  },
  ganadorBannerTitulo: { fontSize: 15, fontWeight: '800', color: Brand.primaryDark },
  ganadorBannerBody: {
    flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16,
  },
  ganadorNumeroCircle: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: Brand.accent, alignItems: 'center', justifyContent: 'center',
  },
  ganadorNumeroLabel: { fontSize: 9, fontWeight: '700', color: Brand.primaryDark, letterSpacing: 1 },
  ganadorNumeroVal: { fontSize: 22, fontWeight: '900', color: Brand.primaryDark },
  ganadorBannerNombre: { fontSize: 16, fontWeight: '800', color: Brand.white },
  ganadorBannerTel: { fontSize: 13, color: Brand.onDarkMuted, marginTop: 2 },
  ganadorBannerFecha: { fontSize: 11, color: Brand.onDarkMuted, marginTop: 4 },
  tuGanasteBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Brand.accent + '30', padding: 12, paddingHorizontal: 16,
    borderTopWidth: 1, borderTopColor: Brand.accent + '40',
  },
  tuGanasteText: { fontSize: 14, fontWeight: '700', color: Brand.accent, flex: 1 },
  cerradaBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    margin: 16,
    marginTop: 0,
    padding: 14,
    backgroundColor: '#F0F4F3',
    borderRadius: 12,
  },
  cerradaText: {
    flex: 1,
    fontSize: 13,
    color: Brand.onLightMuted,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: Brand.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 22,
    gap: 14,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitulo: {
    fontSize: 17,
    fontWeight: '800',
    color: Brand.onLight,
  },
  modalClose: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#F0F4F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalPrecio: {
    fontSize: 14,
    color: Brand.primary,
    fontWeight: '700',
  },
  modalCampo: {
    gap: 6,
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Brand.onLightMuted,
  },
  modalInput: {
    borderWidth: 1.5,
    borderColor: '#E2E8E7',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    color: Brand.onLight,
    backgroundColor: '#F8FAFA',
  },
  notaWrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    backgroundColor: Brand.primary + '12',
    borderRadius: 10,
    padding: 10,
  },
  notaText: {
    flex: 1,
    fontSize: 12,
    color: Brand.primaryDark,
    lineHeight: 17,
  },
  comprarBtn: {
    backgroundColor: Brand.primary,
    borderRadius: 14,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  comprarBtnText: {
    color: Brand.white,
    fontSize: 16,
    fontWeight: '700',
  },
  modalRow: {
    flexDirection: 'row',
    gap: 10,
  },
  // Tarjeta visual
  tarjetaVisual: {
    backgroundColor: Brand.primaryDark,
    borderRadius: 16,
    padding: 18,
    gap: 10,
  },
  tarjetaChip: {
    alignSelf: 'flex-start',
  },
  tarjetaNumVisual: {
    fontSize: 17,
    fontWeight: '700',
    color: Brand.white,
    letterSpacing: 2,
  },
  tarjetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  tarjetaSubLabel: {
    fontSize: 9,
    color: Brand.onDarkMuted,
    fontWeight: '700',
    letterSpacing: 1,
  },
  tarjetaSubVal: {
    fontSize: 13,
    color: Brand.white,
    fontWeight: '600',
  },
  seguridadWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'center',
  },
  seguridadText: {
    fontSize: 11,
    color: Brand.onLightMuted,
  },
  // Procesando
  procesandoWrap: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 14,
  },
  procesandoTitulo: {
    fontSize: 18,
    fontWeight: '700',
    color: Brand.onLight,
  },
  procesandoSub: {
    fontSize: 13,
    color: Brand.onLightMuted,
  },
  // Éxito
  exitoWrap: {
    alignItems: 'center',
    paddingVertical: 16,
    gap: 12,
  },
  exitoIcono: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Brand.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exitoTitulo: {
    fontSize: 22,
    fontWeight: '800',
    color: Brand.onLight,
  },
  exitoSub: {
    fontSize: 14,
    color: Brand.onLightMuted,
    textAlign: 'center',
    lineHeight: 21,
  },
});
