import { Ionicons } from '@expo/vector-icons';
import {
  collection,
  doc,
  getDoc, // <-- Agregado para poder leer el perfil del comprador
  getDocs,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

//Importamos tu clase notificacion
import { enviarNotificacion } from '@/utils/notificaciones'; 

import { db } from '@/config/firebase';
import { Brand } from '@/constants/brand';
import { useAuth } from '@/context/auth';
import type { NumeroDoc, Rifa } from '@/types/rifa';

type NumeroConId = NumeroDoc & { numero: string };

type EstadoRifa = 'activa' | 'cerrada' | 'sorteada';

const ESTADO_LABEL: Record<EstadoRifa, string> = {
  activa: 'Activa',
  cerrada: 'Cerrada',
  sorteada: 'Sorteada',
};
const ESTADO_COLOR: Record<EstadoRifa, string> = {
  activa: Brand.success,
  cerrada: Brand.onLightMuted,
  sorteada: Brand.accent,
};

function alerta(titulo: string, msg: string) {
  if (Platform.OS === 'web') { window.alert(`${titulo}\n${msg}`); return; }
}

// --- NUEVA FUNCIÓN: Notificación remota a todos los participantes ---
async function notificarResultadosSorteo(rifaId: string, tituloRifa: string, numeroGanador: string, uidGanador: string) {
  try {
    const numerosRef = collection(db, 'rifas', rifaId, 'numeros');
    const numerosSnap = await getDocs(numerosRef);

    // Usamos Set para evitar mandar notificaciones duplicadas a alguien que compró varios números
    const compradoresUids = new Set<string>();
    numerosSnap.forEach(docSnap => {
      const data = docSnap.data();
      if (data.comprador_uid) {
        compradoresUids.add(data.comprador_uid);
      }
    });

    for (const uid of compradoresUids) {
      const usuarioRef = doc(db, 'usuarios', uid);
      const usuarioSnap = await getDoc(usuarioRef);
      
      if (!usuarioSnap.exists()) continue;
      
      const token = usuarioSnap.data()?.expoPushToken;
      if (!token) continue;

      let tituloNotif = '';
      let cuerpoNotif = '';

      if (uid === uidGanador) {
        tituloNotif = '¡FELICIDADES! 🎉';
        cuerpoNotif = `Has sido el ganador de la rifa "${tituloRifa}" con el número ${numeroGanador}.`;
      } else {
        tituloNotif = 'Sorteo Finalizado 🎲';
        cuerpoNotif = `La rifa "${tituloRifa}" ya se ha jugado. ¡Suerte a la próxima!`;
      }

      const mensaje = {
        to: token,
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
    }
  } catch (error) {
    console.error('Error al notificar los resultados del sorteo:', error);
  }
}
// --------------------------------------------------------------------

export default function AdminRifaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { perfil } = useAuth();

  const [rifa, setRifa] = useState<Rifa | null>(null);
  const [numeros, setNumeros] = useState<NumeroConId[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');

  // Modal sorteo
  const [sorteando, setSorteando] = useState(false);
  const [ganadorModal, setGanadorModal] = useState(false);
  const [ganador, setGanador] = useState<NumeroConId | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [numAnimado, setNumAnimado] = useState<string>('');

  // Cambio de estado
  const [cambiandoEstado, setCambiandoEstado] = useState(false);

  useEffect(() => {
    if (!id) return;
    const unsubRifa = onSnapshot(doc(db, 'rifas', id), snap => {
      if (snap.exists()) setRifa({ id: snap.id, ...snap.data() } as Rifa);
      setCargando(false);
    });
    const unsubNum = onSnapshot(collection(db, 'rifas', id, 'numeros'), snap => {
      setNumeros(snap.docs.map(d => ({ ...(d.data() as NumeroDoc), numero: d.id }))
        .sort((a, b) => Number(a.numero) - Number(b.numero)));
    });
    return () => { unsubRifa(); unsubNum(); };
  }, [id]);

  const numerosFiltrados = useMemo(() => {
    const q = busqueda.toLowerCase();
    if (!q) return numeros;
    return numeros.filter(n =>
      n.numero.includes(q) ||
      n.comprador_nombre.toLowerCase().includes(q) ||
      n.comprador_telefono.includes(q)
    );
  }, [numeros, busqueda]);

  const pagados = numeros.filter(n => n.pagado).length;
  const pendientes = numeros.filter(n => !n.pagado).length;
  const ingresos = pagados * (rifa?.precio ?? 0);

  async function cambiarEstado(nuevoEstado: EstadoRifa) {
    if (!id || !rifa) return;
    if (nuevoEstado === rifa.estado) return;
    const confirm = Platform.OS === 'web'
      ? window.confirm(`¿Cambiar estado a "${ESTADO_LABEL[nuevoEstado]}"?`)
      : true;
    if (!confirm) return;
    setCambiandoEstado(true);
    try {
      await updateDoc(doc(db, 'rifas', id), { estado: nuevoEstado });
    } catch {
      alerta('Error', 'No se pudo cambiar el estado.');
    } finally {
      setCambiandoEstado(false);
    }
  }

  async function togglePagado(numero: NumeroConId) {
    if (!id) return;
    try {
      await updateDoc(doc(db, 'rifas', id, 'numeros', numero.numero), {
        pagado: !numero.pagado,
      });
    } catch {
      alerta('Error', 'No se pudo actualizar el estado de pago.');
    }
  }

  async function realizarSorteo() {
    if (!id || !rifa) return;
    const elegibles = numeros.filter(n => n.pagado);
    if (elegibles.length === 0) {
      alerta('Sin elegibles', 'No hay números pagados para sortear. Confirmá los pagos primero.');
      return;
    }
    const confirm = Platform.OS === 'web'
      ? window.confirm(`¿Realizar el sorteo ahora? Se elegirá un ganador al azar entre ${elegibles.length} número(s) pagado(s). Esta acción no se puede deshacer.`)
      : true;
    if (!confirm) return;

    setSorteando(true);

    // Cuenta regresiva 3 → 2 → 1
    for (const n of [3, 2, 1]) {
      setCountdown(n);
      await new Promise(r => setTimeout(r, 800));
    }
    setCountdown(null);

    // Animación de números girando (400ms)
    const intervalo = setInterval(() => {
      setNumAnimado(String(Math.floor(Math.random() * rifa!.total_numeros) + 1));
    }, 80);
    await new Promise(r => setTimeout(r, 1200));
    clearInterval(intervalo);
    setNumAnimado('');

    const ganadorElegido = elegibles[Math.floor(Math.random() * elegibles.length)];

    try {
      await updateDoc(doc(db, 'rifas', id), {
        estado: 'sorteada',
        ganador_numero: ganadorElegido.numero,
        ganador_nombre: ganadorElegido.comprador_nombre,
        ganador_telefono: ganadorElegido.comprador_telefono,
        ganador_uid: ganadorElegido.comprador_uid,
        sorteado_en: serverTimestamp(),
      });
      setGanador(ganadorElegido);
      setGanadorModal(true);

      // Llamada a la clase de notificaciones local para el administrador
      await enviarNotificacion(
        "¡Tenemos Ganador!",
        `El número #${ganadorElegido.numero} es el ganador de la rifa "${rifa.titulo}"`
      );

      // LLAMADA NUEVA: Disparamos la notificación masiva a los celulares de los compradores
      // (Lo llamamos sin 'await' para que no bloquee la interfaz gráfica del admin)
      notificarResultadosSorteo(id, rifa.titulo, ganadorElegido.numero, ganadorElegido.comprador_uid);

    } catch {
      alerta('Error', 'No se pudo registrar el ganador.');
    } finally {
      setSorteando(false);
    }
  }

  if (cargando) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }, styles.center]}>
        <ActivityIndicator size="large" color={Brand.primary} />
      </View>
    );
  }

  if (!rifa || perfil?.rol !== 'admin') {
    return (
      <View style={[styles.root, { paddingTop: insets.top }, styles.center]}>
        <Text style={styles.errorText}>Sin acceso.</Text>
      </View>
    );
  }

  const estadoColor = ESTADO_COLOR[rifa.estado];

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

      <FlatList
        data={numerosFiltrados}
        keyExtractor={n => n.numero}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            {/* Info rifa */}
            <View style={styles.infoCard}>
              <Text style={styles.premio}>🎁 {rifa.premio}</Text>
              {rifa.descripcion ? <Text style={styles.desc}>{rifa.descripcion}</Text> : null}

              {/* Stats */}
              <View style={styles.statsRow}>
                <MiniStat icono="people" valor={numeros.length} label="Vendidos" color={Brand.primary} />
                <MiniStat icono="checkmark-circle" valor={pagados} label="Pagados" color={Brand.success} />
                <MiniStat icono="time" valor={pendientes} label="Pendientes" color={Brand.accent} />
                <MiniStat icono="cash" valor={`₡${(ingresos / 1000).toFixed(0)}k`} label="Ingresos" color="#6C63FF" texto />
              </View>

              {/* Barra progreso */}
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, {
                  width: `${Math.round((rifa.vendidos / rifa.total_numeros) * 100)}%` as any,
                }]} />
              </View>
              <Text style={styles.progressLabel}>
                {rifa.vendidos}/{rifa.total_numeros} números vendidos
              </Text>
            </View>

            {/* Ganador actual */}
            {rifa.estado === 'sorteada' && rifa.ganador_numero && (
              <View style={styles.ganadorCard}>
                <View style={styles.ganadorTrofeo}>
                  <Ionicons name="trophy" size={28} color={Brand.white} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.ganadorLabel}>¡Ganador del sorteo!</Text>
                  <Text style={styles.ganadorNumero}>Número #{rifa.ganador_numero}</Text>
                  <Text style={styles.ganadorNombre}>{rifa.ganador_nombre}</Text>
                  <Text style={styles.ganadorTel}>{rifa.ganador_telefono}</Text>
                </View>
              </View>
            )}

            {/* Cambiar estado */}
            <View style={styles.seccion}>
              <Text style={styles.seccionLabel}>Estado de la rifa</Text>
              <View style={styles.estadoRow}>
                {(['activa', 'cerrada', 'sorteada'] as EstadoRifa[]).map(e => (
                  <Pressable
                    key={e}
                    style={[
                      styles.estadoBtn,
                      rifa.estado === e && { backgroundColor: ESTADO_COLOR[e], borderColor: ESTADO_COLOR[e] },
                      rifa.estado !== e && { borderColor: ESTADO_COLOR[e] + '55' },
                    ]}
                    onPress={() => cambiarEstado(e)}
                    disabled={cambiandoEstado || rifa.estado === e}>
                    <Text style={[
                      styles.estadoBtnText,
                      { color: rifa.estado === e ? Brand.white : ESTADO_COLOR[e] },
                    ]}>
                      {ESTADO_LABEL[e]}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Botón sortear */}
            {rifa.estado !== 'sorteada' && (
              <Pressable
                style={({ pressed }) => [styles.sortearBtn, pressed && { opacity: 0.85 }, sorteando && { opacity: 0.7 }]}
                onPress={realizarSorteo}
                disabled={sorteando}>
                {sorteando ? (
                  <View style={styles.sorteoAnimacion}>
                    <ActivityIndicator color={Brand.white} />
                    <Text style={styles.sortearBtnText}>Sorteando…</Text>
                  </View>
                ) : (
                  <>
                    <Ionicons name="trophy" size={18} color={Brand.white} />
                    <Text style={styles.sortearBtnText}>Realizar sorteo</Text>
                  </>
                )}
              </Pressable>
            )}

            {/* Búsqueda */}
            <View style={styles.busquedaWrap}>
              <Ionicons name="search-outline" size={16} color={Brand.onLightMuted} />
              <TextInput
                style={styles.busquedaInput}
                value={busqueda}
                onChangeText={setBusqueda}
                placeholder="Buscar por número, nombre o teléfono…"
                placeholderTextColor={Brand.onLightMuted}
              />
              {busqueda ? (
                <Pressable onPress={() => setBusqueda('')}>
                  <Ionicons name="close-circle" size={16} color={Brand.onLightMuted} />
                </Pressable>
              ) : null}
            </View>

            <Text style={styles.listaHeader}>
              {numerosFiltrados.length} resultado{numerosFiltrados.length !== 1 ? 's' : ''}
            </Text>
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyNumeros}>
            <Ionicons name="receipt-outline" size={36} color={Brand.onLightMuted} />
            <Text style={styles.emptyText}>
              {busqueda ? 'Sin resultados para esa búsqueda' : 'Aún no se vendieron números'}
            </Text>
          </View>
        }
        renderItem={({ item: n }) => (
          <View style={[styles.numeroRow, n.pagado && styles.numeroRowPagado]}>
            <View style={[styles.numeroBadge, { backgroundColor: n.pagado ? Brand.success : Brand.accent }]}>
              <Text style={styles.numeroBadgeText}>#{n.numero}</Text>
            </View>
            <View style={styles.numeroInfo}>
              <Text style={styles.numeroNombre}>{n.comprador_nombre}</Text>
              <Text style={styles.numeroTel}>{n.comprador_telefono}</Text>
            </View>
            <Pressable
              style={[styles.pagoBtn, n.pagado ? styles.pagoBtnPagado : styles.pagoBtnPendiente]}
              onPress={() => togglePagado(n)}>
              <Ionicons
                name={n.pagado ? 'checkmark-circle' : 'ellipse-outline'}
                size={14}
                color={n.pagado ? Brand.white : Brand.accent}
              />
              <Text style={[styles.pagoBtnText, n.pagado ? styles.pagoBtnTextPagado : styles.pagoBtnTextPendiente]}>
                {n.pagado ? 'Pagado' : 'Pendiente'}
              </Text>
            </Pressable>
          </View>
        )}
      />

      {/* Overlay animación sorteo */}
      <Modal visible={sorteando} transparent animationType="fade">
        <View style={styles.sorteoOverlay}>
          <View style={styles.sorteoCard}>
            {countdown !== null ? (
              <>
                <Text style={styles.countdownLabel}>El sorteo empieza en</Text>
                <Text style={styles.countdownNum}>{countdown}</Text>
              </>
            ) : (
              <>
                <ActivityIndicator size="large" color={Brand.accent} />
                <Text style={styles.sorteoGirando}>Sorteando…</Text>
                <View style={styles.numAnimadoCircle}>
                  <Text style={styles.numAnimadoText}>{numAnimado || '?'}</Text>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal ganador */}
      <Modal visible={ganadorModal} transparent animationType="fade" onRequestClose={() => setGanadorModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.ganadorModalCard}>
            <View style={styles.ganadorModalTrofeo}>
              <Ionicons name="trophy" size={48} color={Brand.white} />
            </View>
            <Text style={styles.ganadorModalTitulo}>¡Tenemos ganador!</Text>
            <View style={styles.ganadorModalNumero}>
              <Text style={styles.ganadorModalNumeroText}>#{ganador?.numero}</Text>
            </View>
            <Text style={styles.ganadorModalNombre}>{ganador?.comprador_nombre}</Text>
            <Text style={styles.ganadorModalTel}>{ganador?.comprador_telefono}</Text>
            <Text style={styles.ganadorModalNota}>
              Contactá al ganador para coordinar la entrega del premio.
            </Text>
            <Pressable
              style={({ pressed }) => [styles.ganadorModalBtn, pressed && { opacity: 0.85 }]}
              onPress={() => setGanadorModal(false)}>
              <Text style={styles.ganadorModalBtnText}>¡Excelente!</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function MiniStat({ icono, valor, label, color, texto }: {
  icono: any; valor: number | string; label: string; color: string; texto?: boolean;
}) {
  return (
    <View style={styles.miniStat}>
      <Ionicons name={icono} size={16} color={color} />
      <Text style={[styles.miniStatValor, { color }]}>{valor}</Text>
      <Text style={styles.miniStatLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.cream },
  center: { alignItems: 'center', justifyContent: 'center', gap: 10 },
  errorText: { fontSize: 15, color: Brand.onLightMuted },

  navBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: Brand.white, borderBottomWidth: 1, borderBottomColor: '#E7EEED',
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: '#F0F4F3',
    alignItems: 'center', justifyContent: 'center',
  },
  navTitulo: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: Brand.onLight, marginHorizontal: 8 },

  listContent: { paddingBottom: 32 },

  // Info card
  infoCard: {
    margin: 16, backgroundColor: Brand.white, borderRadius: 18, padding: 16, gap: 10,
    borderWidth: 1, borderColor: '#E7EEED',
  },
  premio: { fontSize: 16, fontWeight: '800', color: Brand.onLight },
  desc: { fontSize: 13, color: Brand.onLightMuted, lineHeight: 18 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 4 },
  miniStat: { alignItems: 'center', gap: 3 },
  miniStatValor: { fontSize: 16, fontWeight: '800' },
  miniStatLabel: { fontSize: 10, color: Brand.onLightMuted, fontWeight: '600' },
  progressBar: { height: 7, borderRadius: 4, backgroundColor: '#E7EEED', overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Brand.primary, borderRadius: 4 },
  progressLabel: { fontSize: 12, color: Brand.onLightMuted, textAlign: 'right' },

  // Ganador card (cuando ya fue sorteada)
  ganadorCard: {
    marginHorizontal: 16, marginBottom: 4,
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Brand.accent + '18', borderRadius: 16, padding: 16,
    borderWidth: 1.5, borderColor: Brand.accent + '55',
  },
  ganadorTrofeo: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: Brand.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  ganadorLabel: { fontSize: 11, fontWeight: '700', color: Brand.primaryDark, textTransform: 'uppercase', letterSpacing: 0.8 },
  ganadorNumero: { fontSize: 20, fontWeight: '800', color: Brand.onLight },
  ganadorNombre: { fontSize: 14, fontWeight: '700', color: Brand.onLight },
  ganadorTel: { fontSize: 13, color: Brand.onLightMuted },

  // Cambiar estado
  seccion: {
    marginHorizontal: 16, marginBottom: 10,
    backgroundColor: Brand.white, borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: '#E7EEED', gap: 10,
  },
  seccionLabel: { fontSize: 11, fontWeight: '700', color: Brand.onLightMuted, textTransform: 'uppercase', letterSpacing: 0.8 },
  estadoRow: { flexDirection: 'row', gap: 8 },
  estadoBtn: {
    flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center',
    borderWidth: 1.5, backgroundColor: Brand.white,
  },
  estadoBtnText: { fontSize: 12, fontWeight: '700' },

  // Sorteo
  sortearBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginHorizontal: 16, marginBottom: 16,
    backgroundColor: Brand.primaryDark, borderRadius: 16, height: 52,
  },
  sorteoAnimacion: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sortearBtnText: { color: Brand.white, fontSize: 16, fontWeight: '700' },

  // Búsqueda
  busquedaWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginBottom: 8,
    backgroundColor: Brand.white, borderRadius: 14, paddingHorizontal: 14, height: 44,
    borderWidth: 1, borderColor: '#E7EEED',
  },
  busquedaInput: { flex: 1, fontSize: 14, color: Brand.onLight },
  listaHeader: { fontSize: 12, color: Brand.onLightMuted, fontWeight: '600', paddingHorizontal: 20, marginBottom: 4 },

  // Lista números
  emptyNumeros: { alignItems: 'center', paddingTop: 32, gap: 10 },
  emptyText: { fontSize: 14, color: Brand.onLightMuted },
  numeroRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: '#F0F4F3',
    backgroundColor: Brand.white,
  },
  numeroRowPagado: { backgroundColor: Brand.success + '06' },
  numeroBadge: {
    width: 44, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
  },
  numeroBadgeText: { fontSize: 13, fontWeight: '800', color: Brand.white },
  numeroInfo: { flex: 1 },
  numeroNombre: { fontSize: 14, fontWeight: '600', color: Brand.onLight },
  numeroTel: { fontSize: 12, color: Brand.onLightMuted },
  pagoBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1.5,
  },
  pagoBtnPagado: { backgroundColor: Brand.success, borderColor: Brand.success },
  pagoBtnPendiente: { backgroundColor: Brand.accent + '18', borderColor: Brand.accent + '70' },
  pagoBtnText: { fontSize: 11, fontWeight: '700' },
  pagoBtnTextPagado: { color: Brand.white },
  pagoBtnTextPendiente: { color: '#B07D00' },

  // Overlay animación sorteo
  sorteoOverlay: {
    flex: 1, backgroundColor: 'rgba(6,58,56,0.92)',
    alignItems: 'center', justifyContent: 'center',
  },
  sorteoCard: {
    alignItems: 'center', gap: 16, padding: 40,
    backgroundColor: Brand.primaryDark, borderRadius: 28,
    borderWidth: 2, borderColor: Brand.accent + '55',
  },
  countdownLabel: { fontSize: 16, color: Brand.onDarkMuted, fontWeight: '600' },
  countdownNum: { fontSize: 96, fontWeight: '900', color: Brand.accent, lineHeight: 100 },
  sorteoGirando: { fontSize: 18, color: Brand.onDark, fontWeight: '700' },
  numAnimadoCircle: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: Brand.accent, alignItems: 'center', justifyContent: 'center',
    marginTop: 8,
  },
  numAnimadoText: { fontSize: 40, fontWeight: '900', color: Brand.primaryDark },
  // Modal ganador
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 32 },
  ganadorModalCard: {
    backgroundColor: Brand.white, borderRadius: 24, padding: 28, alignItems: 'center', gap: 12, width: '100%',
  },
  ganadorModalTrofeo: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: Brand.accent,
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  ganadorModalTitulo: { fontSize: 24, fontWeight: '800', color: Brand.onLight },
  ganadorModalNumero: {
    backgroundColor: Brand.primaryDark, borderRadius: 14, paddingVertical: 8, paddingHorizontal: 24,
  },
  ganadorModalNumeroText: { fontSize: 28, fontWeight: '800', color: Brand.white, letterSpacing: 2 },
  ganadorModalNombre: { fontSize: 18, fontWeight: '700', color: Brand.onLight },
  ganadorModalTel: { fontSize: 14, color: Brand.onLightMuted },
  ganadorModalNota: {
    fontSize: 13, color: Brand.onLightMuted, textAlign: 'center', lineHeight: 18,
    paddingHorizontal: 8,
  },
  ganadorModalBtn: {
    backgroundColor: Brand.primary, borderRadius: 14, paddingVertical: 14,
    paddingHorizontal: 40, marginTop: 4,
  },
  ganadorModalBtnText: { color: Brand.white, fontSize: 16, fontWeight: '700' },
});