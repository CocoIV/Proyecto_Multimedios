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
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
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
import QRCode from 'react-native-qrcode-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Importamos tu clase notificacion
import { enviarNotificacion } from '@/utils/notificaciones';

import { db } from '@/config/firebase';
import { AppInfo, Brand } from '@/constants/brand';
import { REGION } from '@/constants/zonas';
import { useAuth } from '@/context/auth';
import type { NumeroDoc, Rifa } from '@/types/rifa';

type NumeroConId = NumeroDoc & { numero: string };
type EstadoNumero = 'libre' | 'mio' | 'ocupado';
type Paso = 'datos' | 'metodo' | 'tarjeta' | 'sinpe' | 'procesando' | 'exito';

// Número SINPE Móvil de la organización (demo).
const SINPE_NUMERO = '8888 - 7777';

// --- NUEVA FUNCIÓN: Notificación remota al creador con lógica de "Rifa Llena" ---
async function procesarNotificacionAlCreador(rifaId: string, numerosComprados: number[]) {
  try {
    const rifaRef = doc(db, 'rifas', rifaId);
    const rifaSnap = await getDoc(rifaRef);

    if (!rifaSnap.exists()) return;

    const datosRifa = rifaSnap.data();
    const creadorUid = datosRifa?.creador_uid ?? datosRifa?.creado_por_uid;
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

    const cantidad = numerosComprados.length;
    const listaNumeros = numerosComprados.map(n => `#${n}`).join(', ');

    // --- LÓGICA INTELIGENTE ---
    let tituloNotif = cantidad > 1 ? `¡${cantidad} Números Vendidos! 🎟️` : '¡Número Vendido! 🎟️';
    let cuerpoNotif = `Se ${cantidad > 1 ? 'compraron los números' : 'compró el número'} ${listaNumeros} en tu rifa "${tituloRifa}".`;

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

/** ["#1","#2","#3"] -> "#1, #2 y #3" */
function formatearNumeros(nums: number[]): string {
  const arr = nums.map(n => `#${n}`);
  if (arr.length <= 1) return arr[0] ?? '';
  return `${arr.slice(0, -1).join(', ')} y ${arr[arr.length - 1]}`;
}

/** Fecha y hora legible para el comprobante: "27 may 2028 · 10:34 a. m." */
function formatearFechaCompra(d: Date): string {
  const fecha = d.toLocaleDateString('es-CR', { day: 'numeric', month: 'short', year: 'numeric' });
  const hora = d.toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' });
  return `${fecha} · ${hora}`;
}

export default function RifaDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, perfil } = useAuth();

  const [rifa, setRifa] = useState<Rifa | null>(null);
  const [numerosVendidos, setNumerosVendidos] = useState<NumeroConId[]>([]);
  const [cargando, setCargando] = useState(true);

  // Números que el usuario va marcando en la grilla (aún sin comprar)
  const [seleccionados, setSeleccionados] = useState<number[]>([]);

  // Estado del modal de compra
  const [modalVisible, setModalVisible] = useState(false);
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
  // Sub-paso animado de la pantalla "Procesando pago": 0=datos, 1=pago, 2=boleto
  const [procesoPaso, setProcesoPaso] = useState(0);
  // Momento exacto en que se confirmó la compra (para el comprobante)
  const [fechaCompra, setFechaCompra] = useState<Date | null>(null);

  // Avanza los pasos de la pantalla de procesamiento mientras dura la simulación
  useEffect(() => {
    if (paso !== 'procesando') return;
    setProcesoPaso(0);
    const t1 = setTimeout(() => setProcesoPaso(1), 900);
    const t2 = setTimeout(() => setProcesoPaso(2), 1800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [paso]);

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

  // Marcar / desmarcar un número de la grilla
  function toggleNumero(n: number) {
    if (rifa?.estado !== 'activa') return;
    if (estadoNumero(n) !== 'libre') return;
    setSeleccionados(prev =>
      prev.includes(n) ? prev.filter(x => x !== n) : [...prev, n]
    );
  }

  // Stepper "¿Cuántos boletos deseas?": + agrega el próximo número libre
  function agregarUno() {
    if (rifa?.estado !== 'activa') return;
    for (let n = 1; n <= (rifa?.total_numeros ?? 0); n++) {
      if (estadoNumero(n) === 'libre' && !seleccionados.includes(n)) {
        setSeleccionados(prev => [...prev, n]);
        return;
      }
    }
  }

  // - quita el último número que se agregó
  function quitarUno() {
    setSeleccionados(prev => prev.slice(0, -1));
  }

  // Abre el modal de compra con todos los números seleccionados
  function irAlResumen() {
    if (seleccionados.length === 0) return;
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
    const numeros = [...seleccionados].sort((a, b) => a - b);
    if (numeros.length === 0) return;

    setPaso('procesando');
    setComprando(true);

    // Simular procesamiento de 2.5 segundos
    await new Promise(r => setTimeout(r, 2500));

    try {
      const rifaRef = doc(db, 'rifas', id!);
      const numeroRefs = numeros.map(n => doc(db, 'rifas', id!, 'numeros', String(n)));

      await runTransaction(db, async (tx) => {
        // Todas las lecturas van primero (requisito de Firestore)
        const rifaSnap = await tx.get(rifaRef);
        if (!rifaSnap.exists()) throw new Error('no-rifa');

        const snaps = await Promise.all(numeroRefs.map(ref => tx.get(ref)));
        if (snaps.some(s => s.exists())) throw new Error('ocupado');

        // Luego las escrituras
        numeroRefs.forEach(ref => {
          tx.set(ref, {
            comprador_uid: user!.uid,
            comprador_nombre: compradorNombre.trim(),
            comprador_telefono: compradorTelefono.trim(),
            comprado_en: serverTimestamp(),
            pagado,
            rifa_titulo: rifa?.titulo ?? '',
          });
        });

        tx.update(rifaRef, { vendidos: (rifaSnap.data().vendidos ?? 0) + numeros.length });
      });

      setFechaCompra(new Date());
      setPaso('exito');

      const lista = numeros.map(n => `#${n}`).join(', ');
      enviarNotificacion(
        numeros.length > 1 ? 'Números Adquiridos' : 'Número Adquirido',
        `${numeros.length > 1 ? 'Los números' : 'El número'} ${lista} para la rifa "${rifa?.titulo}" ${numeros.length > 1 ? 'son tuyos' : 'es tuyo'}. Buena suerte`
      ).catch(() => {});

      procesarNotificacionAlCreador(id!, numeros);
    } catch (e: any) {
      setComprando(false);
      setPaso(volverA);
      const msg = e.message === 'ocupado'
        ? 'Alguien acaba de comprar uno de esos números. Revisá tu selección.'
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
  const cantidad = seleccionados.length;
  const total = cantidad * (rifa.precio ?? 0);
  const numerosOrdenados = [...seleccionados].sort((a, b) => a - b);
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

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: cantidad > 0 && esActiva ? 140 : 24 }}>
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

        {/* ¿Cuántos boletos deseas? */}
        {esActiva && (
          <View style={styles.cantidadCard}>
            <Text style={styles.cantidadTitulo}>¿Cuántos boletos deseas?</Text>
            <View style={styles.stepper}>
              <Pressable
                onPress={quitarUno}
                disabled={cantidad === 0}
                style={[styles.stepBtn, cantidad === 0 && styles.stepBtnDisabled]}>
                <Ionicons name="remove" size={22} color={cantidad === 0 ? Brand.onLightMuted : Brand.primary} />
              </Pressable>
              <Text style={styles.stepVal}>{cantidad}</Text>
              <Pressable onPress={agregarUno} style={styles.stepBtnDark}>
                <Ionicons name="add" size={22} color={Brand.white} />
              </Pressable>
            </View>
            <Text style={styles.cantidadHint}>Elige tus números de suerte</Text>
          </View>
        )}

        {/* Leyenda */}
        <View style={styles.leyenda}>
          <LeyendaItem color={Brand.white} border="#D0DAD8" label="Disponible" />
          <LeyendaItem color={Brand.accent} label="Seleccionado" />
          <LeyendaItem color={Brand.primary} label="Tuyo" />
          <LeyendaItem color="#C8D8D6" label="Agotado" />
        </View>

        {/* Grilla de números */}
        <View style={styles.grillaWrap}>
          <View style={styles.grilla}>
            {numeros.map(n => {
              const estado = estadoNumero(n);
              const seleccionado = seleccionados.includes(n);
              return (
                <Pressable
                  key={n}
                  style={[
                    styles.numBtn,
                    estado === 'mio' && styles.numBtnMio,
                    estado === 'ocupado' && styles.numBtnOcupado,
                    seleccionado && styles.numBtnSeleccionado,
                    (!esActiva || estado !== 'libre') && !seleccionado && styles.numBtnDisabled,
                  ]}
                  onPress={() => toggleNumero(n)}
                  disabled={!esActiva || estado !== 'libre'}>
                  <Text style={[
                    styles.numText,
                    estado === 'mio' && styles.numTextMio,
                    estado === 'ocupado' && styles.numTextOcupado,
                    seleccionado && styles.numTextSeleccionado,
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

      {/* Barra inferior con total y CTA */}
      {esActiva && cantidad > 0 && (
        <View style={[styles.footerBar, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.footerInfo}>
            <Text style={styles.footerCount}>
              {cantidad} boleto{cantidad !== 1 ? 's' : ''} seleccionado{cantidad !== 1 ? 's' : ''}
            </Text>
            <Text style={styles.footerTotal}>Total: ₡{total.toLocaleString('es-CR')}</Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.footerBtn, pressed && { opacity: 0.9 }]}
            onPress={irAlResumen}>
            <Text style={styles.footerBtnText}>Continuar al resumen</Text>
          </Pressable>
        </View>
      )}

      {/* Modal de compra */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={cerrarModal}>
        {paso === 'procesando' ? (
          <View style={styles.procesandoFull}>
            <RingSpinner />
            <Text style={styles.procesandoTitulo}>Procesando tu pago…</Text>
            <Text style={styles.procesandoSub}>
              Por favor espera, estamos confirmando tu transacción.
            </Text>
            <View style={styles.procesoSteps}>
              <ProcesoStep label="Verificando datos…" estado={procesoPaso > 0 ? 'ok' : 'activo'} />
              <ProcesoStep label="Procesando pago…" estado={procesoPaso > 1 ? 'ok' : procesoPaso === 1 ? 'activo' : 'pendiente'} />
              <ProcesoStep label="Generando tu boleto…" estado={procesoPaso >= 2 ? 'activo' : 'pendiente'} />
            </View>
          </View>
        ) : paso === 'exito' ? (
          <View style={styles.exitoRoot}>
            <ScrollView
              contentContainerStyle={[styles.exitoScroll, { paddingBottom: insets.bottom + 24 }]}
              showsVerticalScrollIndicator={false}>

              {/* Hero verde */}
              <View style={[styles.exitoHero, { paddingTop: insets.top + 36 }]}>
                <View style={styles.exitoCheck}>
                  <Ionicons name="checkmark" size={38} color={Brand.white} />
                </View>
                <Text style={styles.exitoHeroTitulo}>¡Pago Confirmado!</Text>
                <Text style={styles.exitoHeroSub}>Tu boleto ha sido generado exitosamente</Text>
              </View>

              {/* Tarjeta boleto comprado */}
              <View style={styles.boletoCard}>
                <View style={styles.boletoCardTop}>
                  <Text style={styles.boletoLabel}>BOLETO COMPRADO</Text>
                  <View style={styles.boletoPrecioBadge}>
                    <Text style={styles.boletoPrecioText}>₡{total.toLocaleString('es-CR')}</Text>
                  </View>
                </View>
                <Text style={styles.boletoTitulo} numberOfLines={1}>{rifa.premio || rifa.titulo}</Text>
                <Text style={styles.boletoNumeros}>
                  Boleto{cantidad !== 1 ? 's' : ''} {formatearNumeros(numerosOrdenados)}
                </Text>
                <View style={styles.boletoDivider} />
                <Text style={styles.boletoMeta}>
                  {rifa.zona ? `${REGION} · ${rifa.zona}` : REGION}
                </Text>
                {fechaCompra && (
                  <Text style={styles.boletoMeta}>{formatearFechaCompra(fechaCompra)}</Text>
                )}
              </View>

              {/* QR */}
              <View style={styles.qrCard}>
                <Text style={styles.qrLabel}>Código QR del boleto</Text>
                <View style={styles.qrBox}>
                  <QRCode
                    value={`TOMBOLITAS|rifa=${id}|n=${numerosOrdenados.join(',')}`}
                    size={140}
                    color={Brand.onLight}
                    backgroundColor={Brand.white}
                  />
                </View>
              </View>

              {/* Botones */}
              <Pressable
                style={({ pressed }) => [styles.exitoBtnPrimary, pressed && { opacity: 0.9 }]}
                onPress={() => { setModalVisible(false); setSeleccionados([]); router.replace('/(tabs)/mis-numeros' as any); }}>
                <Text style={styles.exitoBtnPrimaryText}>Ver mis boletos</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.exitoBtnSecondary, pressed && { opacity: 0.9 }]}
                onPress={() => { setModalVisible(false); setSeleccionados([]); router.replace('/(tabs)' as any); }}>
                <Text style={styles.exitoBtnSecondaryText}>Volver al inicio</Text>
              </Pressable>
            </ScrollView>
          </View>
        ) : (
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={[styles.modalCard, { paddingBottom: insets.bottom + 16 }]}>

            {/* PASO 1: Datos personales */}
            {paso === 'datos' && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitulo}>{cantidad} boleto{cantidad !== 1 ? 's' : ''}</Text>
                  <Pressable onPress={cerrarModal} style={styles.modalClose}>
                    <Ionicons name="close" size={20} color={Brand.onLightMuted} />
                  </Pressable>
                </View>

                {/* Chips de números elegidos */}
                <View style={styles.chipsWrap}>
                  {numerosOrdenados.map(n => (
                    <View key={n} style={styles.chip}>
                      <Text style={styles.chipText}>#{n}</Text>
                    </View>
                  ))}
                </View>

                <View style={styles.resumenLinea}>
                  <Text style={styles.resumenLineaLabel}>
                    {cantidad} × ₡{(rifa.precio ?? 0).toLocaleString('es-CR')}
                  </Text>
                  <Text style={styles.resumenLineaTotal}>₡{total.toLocaleString('es-CR')}</Text>
                </View>
                <Text style={styles.modalPrecio}>Pagá con Tarjeta o SINPE Móvil</Text>
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
                  <Text style={styles.comprarBtnText}>Pagar ₡{total.toLocaleString('es-CR')}</Text>
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
                  <Text style={styles.sinpeMonto}>Monto exacto: ₡{total.toLocaleString('es-CR')}</Text>
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

          </View>
        </KeyboardAvoidingView>
        )}
      </Modal>
    </View>
  );
}

/** Anillo naranja girando para la pantalla de procesamiento. */
function RingSpinner() {
  const rot = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.timing(rot, { toValue: 1, duration: 1000, easing: Easing.linear, useNativeDriver: true }),
    );
    anim.start();
    return () => anim.stop();
  }, [rot]);
  const spin = rot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return <Animated.View style={[styles.ring, { transform: [{ rotate: spin }] }]} />;
}

/** Una fila de estado en la pantalla de procesamiento. */
function ProcesoStep({ label, estado }: { label: string; estado: 'ok' | 'activo' | 'pendiente' }) {
  return (
    <View style={[styles.procesoStep, estado === 'activo' && styles.procesoStepActivo, estado === 'pendiente' && styles.procesoStepPendiente]}>
      <View style={[styles.procesoDot, estado !== 'pendiente' && styles.procesoDotActivo]}>
        {estado === 'ok' && <Ionicons name="checkmark" size={12} color={Brand.primaryDeep} />}
      </View>
      <Text style={[styles.procesoStepText, estado === 'pendiente' && styles.procesoStepTextPendiente]}>{label}</Text>
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
  numBtnSeleccionado: { backgroundColor: Brand.accent, borderColor: Brand.accent },
  numBtnDisabled: { opacity: 0.85 },
  numText: { fontSize: 13, fontWeight: '700', color: Brand.onLight },
  numTextMio: { color: Brand.white },
  numTextOcupado: { color: Brand.onLightMuted },
  numTextSeleccionado: { color: Brand.white },

  // --- ¿CUÁNTOS BOLETOS? (STEPPER) ---
  cantidadCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    alignItems: 'center',
    gap: 12,
  },
  cantidadTitulo: { fontSize: 16, fontWeight: '800', color: Brand.onLight },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  stepBtn: {
    width: 48, height: 48, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Brand.primary + '18',
  },
  stepBtnDisabled: { backgroundColor: '#EDF1F0' },
  stepBtnDark: {
    width: 48, height: 48, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Brand.primary,
  },
  stepVal: { fontSize: 24, fontWeight: '900', color: Brand.onLight, minWidth: 44, textAlign: 'center' },
  cantidadHint: { fontSize: 14, fontWeight: '700', color: Brand.onLight, alignSelf: 'flex-start' },

  // --- BARRA INFERIOR (TOTAL + CTA) ---
  footerBar: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    backgroundColor: Brand.white,
    borderTopWidth: 1,
    borderTopColor: '#E7EEED',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 10,
    shadowColor: Brand.onLight,
    shadowOpacity: 0.08, shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 }, elevation: 12,
  },
  footerInfo: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  footerCount: { fontSize: 13, color: Brand.onLightMuted, fontWeight: '600' },
  footerTotal: { fontSize: 20, fontWeight: '900', color: Brand.primary },
  footerBtn: {
    backgroundColor: Brand.primary,
    borderRadius: 16,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerBtnText: { color: Brand.white, fontSize: 16, fontWeight: '800' },

  // --- CHIPS / RESUMEN EN MODAL ---
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: Brand.accent + '22',
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  chipText: { fontSize: 14, fontWeight: '800', color: Brand.accentText },
  resumenLinea: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderTopWidth: 1, borderTopColor: '#F0F4F3', paddingTop: 12,
  },
  resumenLineaLabel: { fontSize: 14, color: Brand.onLightMuted, fontWeight: '600' },
  resumenLineaTotal: { fontSize: 20, fontWeight: '900', color: Brand.primary },

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

  // --- PROCESAMIENTO (PANTALLA COMPLETA) ---
  procesandoFull: {
    flex: 1,
    backgroundColor: Brand.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
  },
  ring: {
    width: 92, height: 92, borderRadius: 46,
    borderWidth: 6,
    borderColor: Brand.accent,
    borderTopColor: 'transparent',
    marginBottom: 28,
  },
  procesandoTitulo: { fontSize: 22, fontWeight: '800', color: Brand.white, textAlign: 'center' },
  procesandoSub: {
    fontSize: 14, color: Brand.onDarkMuted, textAlign: 'center',
    marginTop: 8, lineHeight: 20,
  },
  procesoSteps: { alignSelf: 'stretch', gap: 12, marginTop: 34 },
  procesoStep: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Brand.white + '10',
    borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16,
  },
  procesoStepActivo: { backgroundColor: Brand.white + '1A' },
  procesoStepPendiente: { opacity: 0.5 },
  procesoDot: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: Brand.white + '33',
    alignItems: 'center', justifyContent: 'center',
  },
  procesoDotActivo: { backgroundColor: Brand.accent },
  procesoStepText: { fontSize: 15, fontWeight: '700', color: Brand.white },
  procesoStepTextPendiente: { color: Brand.onDarkMuted, fontWeight: '600' },

  // --- ÉXITO (PANTALLA COMPLETA) ---
  exitoRoot: { flex: 1, backgroundColor: Brand.cream },
  exitoScroll: { paddingBottom: 24 },
  exitoHero: {
    backgroundColor: Brand.primaryDark,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    alignItems: 'center',
    paddingBottom: 32,
    paddingHorizontal: 24,
  },
  exitoCheck: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: Brand.success,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  exitoHeroTitulo: { fontSize: 24, fontWeight: '900', color: Brand.white },
  exitoHeroSub: { fontSize: 14, color: Brand.onDarkMuted, marginTop: 6, textAlign: 'center' },

  boletoCard: {
    backgroundColor: Brand.white, borderRadius: 18, padding: 18, gap: 6,
    marginHorizontal: 20, marginTop: 20,
    borderWidth: 1, borderColor: Brand.onLight + '10',
    shadowColor: Brand.onLight, shadowOpacity: 0.06, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  boletoCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  boletoLabel: { fontSize: 11, fontWeight: '800', color: Brand.onLightMuted, letterSpacing: 0.8 },
  boletoPrecioBadge: { backgroundColor: '#F0F4F3', borderRadius: 10, paddingVertical: 5, paddingHorizontal: 12 },
  boletoPrecioText: { fontSize: 14, fontWeight: '900', color: Brand.primary },
  boletoTitulo: { fontSize: 20, fontWeight: '900', color: Brand.onLight, marginTop: 2 },
  boletoNumeros: { fontSize: 14, color: Brand.onLightMuted, fontWeight: '600' },
  boletoDivider: { height: 1, backgroundColor: '#F0F4F3', marginVertical: 8 },
  boletoMeta: { fontSize: 13, color: Brand.onLightMuted },

  qrCard: {
    backgroundColor: Brand.white, borderRadius: 18, padding: 18, gap: 14,
    marginHorizontal: 20, marginTop: 14,
    borderWidth: 1, borderColor: Brand.onLight + '10',
    shadowColor: Brand.onLight, shadowOpacity: 0.06, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  qrLabel: { fontSize: 13, fontWeight: '700', color: Brand.onLight },
  qrBox: { alignSelf: 'center', padding: 8, backgroundColor: Brand.white, borderRadius: 12 },

  exitoBtnPrimary: {
    backgroundColor: Brand.primaryDark, borderRadius: 16, height: 54,
    alignItems: 'center', justifyContent: 'center',
    marginHorizontal: 20, marginTop: 22,
  },
  exitoBtnPrimaryText: { color: Brand.white, fontSize: 16, fontWeight: '800' },
  exitoBtnSecondary: {
    borderRadius: 16, height: 54,
    alignItems: 'center', justifyContent: 'center',
    marginHorizontal: 20, marginTop: 12,
    borderWidth: 1.5, borderColor: Brand.primary + '55',
  },
  exitoBtnSecondaryText: { color: Brand.primary, fontSize: 16, fontWeight: '800' },

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