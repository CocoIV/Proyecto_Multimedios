import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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

// Importamos tu clase notificacion
import { enviarNotificacion } from '@/utils/notificaciones'; 

import { db } from '@/config/firebase';
import { AppInfo, Brand } from '@/constants/brand';
import { useAuth } from '@/context/auth';
import type { NumeroDoc, Rifa } from '@/types/rifa';

type NumeroConId = NumeroDoc & { numero: string };
type EstadoNumero = 'libre' | 'mio' | 'ocupado';
type Paso = 'datos' | 'metodo' | 'tarjeta' | 'sinpe' | 'procesando' | 'exito';

// Número SINPE Móvil de la organización (demo).
const SINPE_NUMERO = '8888 - 7777';

// --- NUEVA FUNCIÓN: Notificación remota al creador con lógica de "Rifa Llena" ---
async function procesarNotificacionAlCreador(rifaId: string, numeroComprado: string) {
  try {
    const rifaRef = doc(db, 'rifas', rifaId);
    const rifaSnap = await getDoc(rifaRef);
    
    if (!rifaSnap.exists()) return;
    
    const datosRifa = rifaSnap.data();
    const creadorUid = datosRifa?.creador_uid;
    const tituloRifa = datosRifa?.titulo ?? 'tu rifa';
    const totalNumeros = datosRifa?.total_numeros ?? 0;
    const vendidos = datosRifa?.vendidos ?? 0;

    if (!creadorUid) return;

    // Buscamos el token del creador
    const usuarioRef = doc(db, 'usuarios', creadorUid);
    const usuarioSnap = await getDoc(usuarioRef);

    if (!usuarioSnap.exists()) return;

    const tokenDelAdmin = usuarioSnap.data()?.expoPushToken;

    if (!tokenDelAdmin) {
      console.log('El creador no tiene token registrado.');
      return;
    }

    // --- LÓGICA INTELIGENTE ---
    let tituloNotif = '¡Número Vendido! 🎟️';
    let cuerpoNotif = `Se compró el número ${numeroComprado} en tu rifa "${tituloRifa}".`;

    // Si los vendidos son iguales o mayores al total, ¡es "Sold Out"!
    if (vendidos >= totalNumeros) {
      tituloNotif = '¡RIFA LLENA! 🏆';
      cuerpoNotif = `¡Felicidades! Se han vendido todos los números de "${tituloRifa}". Es hora de sortear.`;
    }

    const mensaje = {
      to: tokenDelAdmin,
      sound: 'default',
      title: tituloNotif,
      body: cuerpoNotif,
      data: { rifaId: rifaId },
    };

    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(mensaje),
    });

  } catch (error) {
    console.error('Error al notificar al creador:', error);
  }
}
// -----------------------------------------------------

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
  // Pago simulado. Pasos: datos → metodo → (tarjeta | sinpe) → procesando → exito
  const [paso, setPaso] = useState<Paso>('datos');
  const [tarjetaNum, setTarjetaNum] = useState('');
  const [tarjetaExp, setTarjetaExp] = useState('');
  const [tarjetaCvv, setTarjetaCvv] = useState('');
  const [tarjetaNombre, setTarjetaNombre] = useState('');
  const [capturaSinpe, setCapturaSinpe] = useState<string | null>(null);

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
    setPaso('datos');
    setTarjetaNum(''); setTarjetaExp(''); setTarjetaCvv(''); setTarjetaNombre('');
    setCapturaSinpe(null);
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
    setPaso('metodo');
  }

  async function elegirCaptura() {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.6,
    });
    if (!res.canceled && res.assets?.[0]) {
      setCapturaSinpe(res.assets[0].uri);
    }
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
    // Tarjeta: se marca como pagado de inmediato.
    await registrarCompra(true, 'tarjeta');
  }

  async function confirmarSinpe() {
    // SINPE queda pendiente de verificación del organizador (pagado: false).
    await registrarCompra(false, 'sinpe');
  }

  /**
   * Reserva el número en Firestore de forma atómica.
   * @param pagado true para tarjeta (inmediato), false para SINPE (pendiente).
   * @param volverA paso al que regresar si algo falla.
   */
  async function registrarCompra(pagado: boolean, volverA: Paso) {
    setPaso('procesando');
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
          pagado,
          rifa_titulo: rifa?.titulo ?? '',
        });

        tx.update(rifaRef, { vendidos: (rifaSnap.data().vendidos ?? 0) + 1 });
      });

      setPaso('exito');

      enviarNotificacion(
        "Numero Adquirido",
        `El numero #${numeroSeleccionado} para la rifa "${rifa?.titulo}" es tuyo. Buena suerte`
      ).catch(() => {});

      procesarNotificacionAlCreador(id!, String(numeroSeleccionado));
    } catch (e: any) {
      setComprando(false);
      setPaso(volverA);
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
  const esCreador = rifa.creado_por_uid === user?.uid;
  const puedeGestionar = esAdmin || esCreador;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* NavBar */}
      <View style={styles.navBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Brand.onLight} />
        </Pressable>
        <Text style={styles.navTitulo} numberOfLines={1}>{rifa.titulo}</Text>
        {puedeGestionar ? (
          <Pressable onPress={() => router.push(`/admin-rifa/${rifa.id}` as any)} style={styles.backBtn}>
            <Ionicons name="settings-outline" size={20} color={Brand.primary} />
          </Pressable>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Info de la rifa */}
        <View style={styles.infoCard}>
          <Text style={styles.premioLabel}>Premio</Text>
          <Text style={styles.premioText}>Premio: {rifa.premio}</Text>
          {rifa.descripcion ? <Text style={styles.desc}>{rifa.descripcion}</Text> : null}

          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statVal}>₡{(rifa.precio ?? 0).toLocaleString('es-CR')}</Text>
              <Text style={styles.statLabel}>por numero</Text>
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
              <Text style={styles.ganadorBannerTitulo}>Tenemos ganador</Text>
            </View>
            <View style={styles.ganadorBannerBody}>
              <View style={styles.ganadorNumeroCircle}>
                <Text style={styles.ganadorNumeroLabel}>N</Text>
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
                <Text style={styles.tuGanasteText}>Sos el ganador. Contacta al organizador.</Text>
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
              Esta rifa esta {rifa.estado === 'sorteada' ? 'sorteada' : 'cerrada'} — ya no se pueden comprar numeros.
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
            {paso === 'datos' && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitulo}>Numero #{numeroSeleccionado}</Text>
                  <Pressable onPress={cerrarModal} style={styles.modalClose}>
                    <Ionicons name="close" size={20} color={Brand.onLightMuted} />
                  </Pressable>
                </View>
                <Text style={styles.modalPrecio}>₡{(rifa.precio ?? 0).toLocaleString('es-CR')} · Tarjeta o SINPE Móvil</Text>
                <View style={styles.modalCampo}>
                  <Text style={styles.modalLabel}>Nombre completo</Text>
                  <TextInput style={styles.modalInput} value={compradorNombre} onChangeText={setCompradorNombre}
                    placeholder="Tu nombre" placeholderTextColor={Brand.onLightMuted} autoCapitalize="words" />
                </View>
                <View style={styles.modalCampo}>
                  <Text style={styles.modalLabel}>Telefono</Text>
                  <TextInput style={styles.modalInput} value={compradorTelefono} onChangeText={setCompradorTelefono}
                    placeholder="Ej: 8888-8888" placeholderTextColor={Brand.onLightMuted} keyboardType="phone-pad" />
                </View>
                <Pressable style={({ pressed }) => [styles.comprarBtn, pressed && { opacity: 0.88 }]} onPress={avanzarAPago}>
                  <Text style={styles.comprarBtnText}>Continuar al pago</Text>
                  <Ionicons name="arrow-forward" size={18} color={Brand.white} />
                </Pressable>
              </>
            )}

            {/* PASO: Método de pago */}
            {paso === 'metodo' && (
              <>
                <View style={styles.modalHeader}>
                  <Pressable onPress={() => setPaso('datos')} style={styles.modalClose}>
                    <Ionicons name="arrow-back" size={20} color={Brand.onLightMuted} />
                  </Pressable>
                  <Text style={styles.modalTitulo}>Método de pago</Text>
                  <Pressable onPress={cerrarModal} style={styles.modalClose}>
                    <Ionicons name="close" size={20} color={Brand.onLightMuted} />
                  </Pressable>
                </View>
                <Text style={styles.modalPrecio}>¿Cómo querés pagar?</Text>

                <Pressable
                  style={({ pressed }) => [styles.metodoOpcion, pressed && { opacity: 0.9 }]}
                  onPress={() => setPaso('tarjeta')}>
                  <View style={[styles.metodoIcono, { backgroundColor: Brand.primary + '18' }]}>
                    <Ionicons name="card" size={22} color={Brand.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.metodoTitulo}>Tarjeta de Crédito / Débito</Text>
                    <Text style={styles.metodoSub}>Visa, Mastercard · débito nacional</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={Brand.onLightMuted} />
                </Pressable>

                <Pressable
                  style={({ pressed }) => [styles.metodoOpcion, pressed && { opacity: 0.9 }]}
                  onPress={() => setPaso('sinpe')}>
                  <View style={[styles.metodoIcono, { backgroundColor: Brand.accent + '22' }]}>
                    <Ionicons name="phone-portrait" size={22} color={Brand.accentText} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.metodoTitulo}>SINPE Móvil</Text>
                    <Text style={styles.metodoSub}>Transferencia y captura del comprobante</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={Brand.onLightMuted} />
                </Pressable>
              </>
            )}

            {/* PASO 2: Datos de tarjeta */}
            {paso === 'tarjeta' && (
              <>
                <View style={styles.modalHeader}>
                  <Pressable onPress={() => setPaso('metodo')} style={styles.modalClose}>
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
                  <Text style={styles.modalLabel}>Numero de tarjeta</Text>
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
                  <Text style={styles.seguridadText}>Pago seguro simulado · Solo para demostracion</Text>
                </View>

                <Pressable style={({ pressed }) => [styles.comprarBtn, pressed && { opacity: 0.88 }]} onPress={procesarPago}>
                  <Ionicons name="card-outline" size={18} color={Brand.white} />
                  <Text style={styles.comprarBtnText}>Pagar ₡{(rifa.precio ?? 0).toLocaleString('es-CR')}</Text>
                </Pressable>
              </>
            )}

            {/* PASO: Pago por SINPE Móvil */}
            {paso === 'sinpe' && (
              <>
                <View style={styles.modalHeader}>
                  <Pressable onPress={() => setPaso('metodo')} style={styles.modalClose}>
                    <Ionicons name="arrow-back" size={20} color={Brand.onLightMuted} />
                  </Pressable>
                  <Text style={styles.modalTitulo}>Pago por SINPE Móvil</Text>
                  <Pressable onPress={cerrarModal} style={styles.modalClose}>
                    <Ionicons name="close" size={20} color={Brand.onLightMuted} />
                  </Pressable>
                </View>

                {/* Datos de transferencia */}
                <View style={styles.sinpeCard}>
                  <Text style={styles.sinpeLabel}>Realizá tu transferencia a:</Text>
                  <Text style={styles.sinpeNumero}>{SINPE_NUMERO}</Text>
                  <Text style={styles.sinpeOrg}>{AppInfo.name} · {AppInfo.region}</Text>
                  <Text style={styles.sinpeMonto}>Monto exacto: ₡{(rifa.precio ?? 0).toLocaleString('es-CR')}</Text>
                </View>

                <Text style={styles.modalLabel}>Subí la captura de la transferencia</Text>
                <Pressable style={styles.uploadBox} onPress={elegirCaptura}>
                  {capturaSinpe ? (
                    <Image source={{ uri: capturaSinpe }} style={styles.uploadPreview} contentFit="cover" />
                  ) : (
                    <View style={styles.uploadVacio}>
                      <Ionicons name="cloud-upload-outline" size={26} color={Brand.onLightMuted} />
                      <Text style={styles.uploadText}>Tocá para subir imagen</Text>
                      <Text style={styles.uploadHint}>PNG, JPG · Máx. 5MB</Text>
                    </View>
                  )}
                </Pressable>
                {capturaSinpe && (
                  <Pressable onPress={elegirCaptura} style={styles.cambiarWrap}>
                    <Ionicons name="repeat" size={13} color={Brand.primary} />
                    <Text style={styles.cambiarText}>Cambiar imagen</Text>
                  </Pressable>
                )}

                <Text style={styles.sinpeNota}>Tu pago será verificado en menos de 2 horas hábiles.</Text>

                <Pressable style={({ pressed }) => [styles.comprarBtn, pressed && { opacity: 0.88 }]} onPress={confirmarSinpe}>
                  <Text style={styles.comprarBtnText}>Confirmar Pago SINPE</Text>
                </Pressable>
              </>
            )}

            {/* PASO 3: Procesando */}
            {paso === 'procesando' && (
              <View style={styles.procesandoWrap}>
                <ActivityIndicator size="large" color={Brand.primary} />
                <Text style={styles.procesandoTitulo}>Procesando pago…</Text>
                <Text style={styles.procesandoSub}>No cerres esta ventana</Text>
              </View>
            )}

            {/* PASO 4: Éxito */}
            {paso === 'exito' && (
              <View style={styles.exitoWrap}>
                <View style={styles.exitoIcono}>
                  <Ionicons name="checkmark" size={40} color={Brand.white} />
                </View>
                <Text style={styles.exitoTitulo}>¡Boleto reservado!</Text>
                <Text style={styles.exitoSub}>
                  El numero <Text style={{ fontWeight: '800' }}>#{numeroSeleccionado}</Text> es tuyo.{'\n'}
                  Buena suerte en el sorteo
                </Text>
                <Pressable
                  style={({ pressed }) => [styles.comprarBtn, { marginTop: 8 }, pressed && { opacity: 0.88 }]}
                  onPress={() => setModalVisible(false)}>
                  <Text style={styles.comprarBtnText}>Ver mi numero</Text>
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
  // --- LAYOUT GENERAL ---
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

  // --- NAVBAR ---
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

  // --- INFO CARDS Y ESTADÍSTICAS ---
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

  // --- GRILLA DE NÚMEROS ---
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
  numBtnMio: { backgroundColor: Brand.primary, borderColor: Brand.primary },
  numBtnOcupado: { backgroundColor: '#C8D8D6', borderColor: '#B0C4C2' },
  numBtnDisabled: { opacity: 0.85 },
  numText: { fontSize: 13, fontWeight: '700', color: Brand.onLight },
  numTextMio: { color: Brand.white },
  numTextOcupado: { color: Brand.onLightMuted },

  // --- BANNERS (GANADOR/CERRADA) ---
  ganadorBanner: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: Brand.primaryDark,
  },
  ganadorBannerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Brand.accent,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  ganadorBannerTitulo: { fontSize: 15, fontWeight: '800', color: Brand.primaryDark },
  ganadorBannerBody: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  ganadorNumeroCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Brand.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ganadorNumeroLabel: { fontSize: 9, fontWeight: '700', color: Brand.primaryDark, letterSpacing: 1 },
  ganadorNumeroVal: { fontSize: 22, fontWeight: '900', color: Brand.primaryDark },
  ganadorBannerNombre: { fontSize: 16, fontWeight: '800', color: Brand.white },
  ganadorBannerTel: { fontSize: 13, color: Brand.onDarkMuted, marginTop: 2 },
  ganadorBannerFecha: { fontSize: 11, color: Brand.onDarkMuted, marginTop: 4 },
  tuGanasteBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: `${Brand.accent}30`,
    padding: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: `${Brand.accent}40`,
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
  cerradaText: { flex: 1, fontSize: 13, color: Brand.onLightMuted },

  // --- MODAL DE COMPRA ---
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
  modalTitulo: { fontSize: 17, fontWeight: '800', color: Brand.onLight },
  modalClose: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#F0F4F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalPrecio: { fontSize: 14, color: Brand.primary, fontWeight: '700' },
  modalCampo: { gap: 6 },
  modalLabel: { fontSize: 12, fontWeight: '700', color: Brand.onLightMuted },
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
  comprarBtn: {
    backgroundColor: Brand.primary,
    borderRadius: 14,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  comprarBtnText: { color: Brand.white, fontSize: 16, fontWeight: '700' },

  // --- PAGO Y TARJETA ---
  tarjetaVisual: { backgroundColor: Brand.primaryDark, borderRadius: 16, padding: 18, gap: 10 },
  tarjetaChip: { alignSelf: 'flex-start' },
  tarjetaNumVisual: { fontSize: 17, fontWeight: '700', color: Brand.white, letterSpacing: 2 },
  tarjetaRow: { flexDirection: 'row', justifyContent: 'space-between' },
  tarjetaSubLabel: { fontSize: 9, color: Brand.onDarkMuted, fontWeight: '700', letterSpacing: 1 },
  tarjetaSubVal: { fontSize: 13, color: Brand.white, fontWeight: '600' },
  modalRow: { flexDirection: 'row', gap: 10 },
  seguridadWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center' },
  seguridadText: { fontSize: 11, color: Brand.onLightMuted },

  // --- PROCESAMIENTO Y ÉXITO ---
  procesandoWrap: { alignItems: 'center', paddingVertical: 32, gap: 14 },
  procesandoTitulo: { fontSize: 18, fontWeight: '700', color: Brand.onLight },
  procesandoSub: { fontSize: 13, color: Brand.onLightMuted },
  exitoWrap: { alignItems: 'center', paddingVertical: 16, gap: 12 },
  exitoIcono: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Brand.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exitoTitulo: { fontSize: 22, fontWeight: '800', color: Brand.onLight },
  exitoSub: { fontSize: 14, color: Brand.onLightMuted, textAlign: 'center', lineHeight: 21 },

  // --- MÉTODO DE PAGO ---
  metodoOpcion: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Brand.white, borderRadius: 14, padding: 14,
    borderWidth: 1.5, borderColor: '#E2E8E7',
  },
  metodoIcono: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  metodoTitulo: { fontSize: 15, fontWeight: '700', color: Brand.onLight },
  metodoSub: { fontSize: 12, color: Brand.onLightMuted, marginTop: 2 },

  // --- SINPE MÓVIL ---
  sinpeCard: {
    backgroundColor: Brand.sand, borderRadius: 16, padding: 18, alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: Brand.accent + '30',
  },
  sinpeLabel: { fontSize: 13, color: Brand.onLightMuted },
  sinpeNumero: { fontSize: 30, fontWeight: '900', color: Brand.primary, letterSpacing: 1 },
  sinpeOrg: { fontSize: 12, color: Brand.onLightMuted },
  sinpeMonto: { fontSize: 14, fontWeight: '800', color: Brand.red, marginTop: 4 },
  uploadBox: {
    height: 130, borderRadius: 16, backgroundColor: Brand.white,
    borderWidth: 2, borderColor: '#D8DCE4', borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  uploadVacio: { alignItems: 'center', gap: 4 },
  uploadText: { fontSize: 14, color: Brand.onLightMuted, fontWeight: '600' },
  uploadHint: { fontSize: 11, color: Brand.onLightMuted },
  uploadPreview: { width: '100%', height: '100%' },
  cambiarWrap: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'center' },
  cambiarText: { fontSize: 13, color: Brand.primary, fontWeight: '600' },
  sinpeNota: { fontSize: 12, color: Brand.onLightMuted, textAlign: 'center' },
});