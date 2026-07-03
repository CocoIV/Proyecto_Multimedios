import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { sendPasswordResetEmail, updateProfile } from 'firebase/auth';
import { collection, collectionGroup, doc, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { auth, db } from '@/config/firebase';
import { Brand } from '@/constants/brand';
import { useAuth } from '@/context/auth';

type Stats = { total: number; pagados: number; pendientes: number; rifas: number };
type OrgStats = { rifas: number; vendidos: number; recaudado: number };

function alerta(titulo: string, msg: string) {
  if (Platform.OS === 'web') { window.alert(`${titulo}\n${msg}`); return; }
  Alert.alert(titulo, msg);
}

export default function PerfilScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, perfil, signOut } = useAuth();

  // Edición de nombre
  const [editandoNombre, setEditandoNombre] = useState(false);
  const [nombre, setNombre] = useState(perfil?.nombre ?? user?.displayName ?? '');
  const [guardandoNombre, setGuardandoNombre] = useState(false);

  // Edición de teléfono
  const [editandoTel, setEditandoTel] = useState(false);
  const [telefono, setTelefono] = useState(perfil?.telefono ?? '');
  const [guardandoTel, setGuardandoTel] = useState(false);

  // Stats (se actualizan en tiempo real)
  const [stats, setStats] = useState<Stats | null>(null);
  const [orgStats, setOrgStats] = useState<OrgStats | null>(null);
  const [cargandoStats, setCargandoStats] = useState(true);

  const iniciales = (perfil?.nombre ?? user?.displayName ?? '?')
    .split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();

  const esEmailUser = user?.providerData.some(p => p.providerId === 'password') ?? false;
  const miembroDesde = (perfil as any)?.creado_en?.toDate
    ? (perfil as any).creado_en.toDate().toLocaleDateString('es-CR', { year: 'numeric', month: 'long' })
    : null;

  // Sincronizar estados cuando carga el perfil
  useEffect(() => {
    if (perfil?.nombre && !editandoNombre) setNombre(perfil.nombre);
    if (perfil?.telefono && !editandoTel) setTelefono(perfil.telefono);
  }, [perfil]);

  // Estadísticas del comprador en tiempo real (números que compré)
  useEffect(() => {
    if (!user) return;
    const q = query(collectionGroup(db, 'numeros'), where('comprador_uid', '==', user.uid));
    const unsub = onSnapshot(q, snap => {
      let pagados = 0;
      const rifasSet = new Set<string>();
      snap.docs.forEach(d => {
        if (d.data().pagado) pagados++;
        const rid = d.ref.parent.parent?.id;
        if (rid) rifasSet.add(rid);
      });
      setStats({ total: snap.size, pagados, pendientes: snap.size - pagados, rifas: rifasSet.size });
      setCargandoStats(false);
    }, () => {
      setStats({ total: 0, pagados: 0, pendientes: 0, rifas: 0 });
      setCargandoStats(false);
    });
    return unsub;
  }, [user]);

  // Estadísticas del organizador en tiempo real (rifas que creé)
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'rifas'), where('creado_por_uid', '==', user.uid));
    const unsub = onSnapshot(q, snap => {
      let vendidos = 0, recaudado = 0;
      snap.docs.forEach(d => {
        const r = d.data();
        vendidos += r.vendidos ?? 0;
        recaudado += (r.vendidos ?? 0) * (r.precio ?? 0);
      });
      setOrgStats({ rifas: snap.size, vendidos, recaudado });
    }, () => setOrgStats({ rifas: 0, vendidos: 0, recaudado: 0 }));
    return unsub;
  }, [user]);

  async function guardarNombre() {
    if (!user || !nombre.trim()) return;
    setGuardandoNombre(true);
    try {
      await updateProfile(user, { displayName: nombre.trim() });
      await updateDoc(doc(db, 'usuarios', user.uid), { nombre: nombre.trim() });
      setEditandoNombre(false);
    } catch {
      alerta('Error', 'No se pudo actualizar el nombre.');
    } finally {
      setGuardandoNombre(false);
    }
  }

  async function guardarTelefono() {
    if (!user) return;
    setGuardandoTel(true);
    try {
      await updateDoc(doc(db, 'usuarios', user.uid), { telefono: telefono.trim() });
      setEditandoTel(false);
    } catch {
      alerta('Error', 'No se pudo guardar el teléfono.');
    } finally {
      setGuardandoTel(false);
    }
  }

  async function cambiarContrasena() {
    if (!user?.email) return;
    try {
      await sendPasswordResetEmail(auth, user.email);
      alerta('Correo enviado', `Revisá tu bandeja de entrada en ${user.email} para restablecer tu contraseña.`);
    } catch {
      alerta('Error', 'No se pudo enviar el correo. Intentá de nuevo.');
    }
  }

  async function confirmarCerrarSesion() {
    if (Platform.OS === 'web') {
      if (window.confirm('¿Cerrar sesión?')) signOut();
      return;
    }
    Alert.alert('Cerrar sesión', '¿Estás seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cerrar sesión', style: 'destructive', onPress: signOut },
    ]);
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.pageHeader}>
        <Text style={styles.titulo}>Mi Perfil</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{iniciales}</Text>
          </View>
          <Text style={styles.nombreDisplay}>{perfil?.nombre ?? user?.displayName ?? '—'}</Text>
          <Text style={styles.emailDisplay}>{user?.email}</Text>
          <View style={styles.pillsRow}>
            {perfil?.rol === 'admin' && (
              <View style={styles.adminPill}>
                <Ionicons name="star" size={12} color={Brand.primaryDark} />
                <Text style={styles.adminPillText}>Administrador</Text>
              </View>
            )}
            {miembroDesde && (
              <View style={styles.fechaPill}>
                <Ionicons name="calendar-outline" size={12} color={Brand.onLightMuted} />
                <Text style={styles.fechaPillText}>Desde {miembroDesde}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Estadísticas del comprador */}
        <View style={styles.seccion}>
          <Text style={styles.seccionLabel}>Mi actividad</Text>
          {cargandoStats ? (
            <View style={styles.statsLoading}>
              <ActivityIndicator size="small" color={Brand.primary} />
            </View>
          ) : (
            <View style={styles.statsGrid}>
              <StatBox icono="ticket" valor={stats?.total ?? 0} label="Números comprados" color={Brand.primary} />
              <StatBox icono="checkmark-circle" valor={stats?.pagados ?? 0} label="Pagados" color={Brand.success} />
              <StatBox icono="time-outline" valor={stats?.pendientes ?? 0} label="Pendientes" color={Brand.accentText} />
              <StatBox icono="apps" valor={stats?.rifas ?? 0} label="Rifas jugadas" color={Brand.accent} />
            </View>
          )}
        </View>

        {/* Estadísticas del organizador (solo si creó rifas) */}
        {orgStats && orgStats.rifas > 0 && (
          <View style={styles.orgCard}>
            <View style={styles.orgTop}>
              <Ionicons name="stats-chart" size={16} color={Brand.accent} />
              <Text style={styles.orgLabel}>COMO ORGANIZADOR</Text>
            </View>
            <Text style={styles.orgRecaudado}>₡{orgStats.recaudado.toLocaleString('es-CR')}</Text>
            <Text style={styles.orgRecaudadoLabel}>recaudado en total</Text>
            <View style={styles.orgFooter}>
              <View style={styles.orgFooterItem}>
                <Text style={styles.orgFooterValor}>{orgStats.rifas}</Text>
                <Text style={styles.orgFooterLabel}>rifas creadas</Text>
              </View>
              <View style={styles.orgFooterDiv} />
              <View style={styles.orgFooterItem}>
                <Text style={styles.orgFooterValor}>{orgStats.vendidos}</Text>
                <Text style={styles.orgFooterLabel}>boletos vendidos</Text>
              </View>
            </View>
          </View>
        )}

        {/* Organizador */}
        <View style={styles.seccion}>
          <Text style={styles.seccionLabel}>Organizador</Text>
          <Pressable
            style={({ pressed }) => [styles.campo, pressed && { backgroundColor: '#F8FAFA' }]}
            onPress={() => router.push('/mis-rifas' as any)}>
            <View style={[styles.campoIcono, { backgroundColor: Brand.primary + '15' }]}>
              <Ionicons name="albums-outline" size={17} color={Brand.primary} />
            </View>
            <View style={styles.campoInfo}>
              <Text style={styles.campoLabel}>Mis rifas creadas</Text>
              <Text style={styles.campoValor}>Gestioná tus rifas y su recaudación</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Brand.onLightMuted} />
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.campo, styles.separador, pressed && { backgroundColor: '#F8FAFA' }]}
            onPress={() => router.push('/crear-rifa' as any)}>
            <View style={[styles.campoIcono, { backgroundColor: Brand.accent + '20' }]}>
              <Ionicons name="add-circle-outline" size={17} color={Brand.accentText} />
            </View>
            <View style={styles.campoInfo}>
              <Text style={styles.campoLabel}>Crear rifa</Text>
              <Text style={styles.campoValor}>Publicá una nueva rifa</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Brand.onLightMuted} />
          </Pressable>
        </View>

        {/* Información personal */}
        <View style={styles.seccion}>
          <Text style={styles.seccionLabel}>Información personal</Text>

          {/* Nombre */}
          <CampoEditable
            icono="person-outline"
            label="Nombre"
            valor={editandoNombre ? nombre : (perfil?.nombre ?? user?.displayName ?? '—')}
            editando={editandoNombre}
            guardando={guardandoNombre}
            onEditar={() => setEditandoNombre(true)}
            onCancelar={() => { setEditandoNombre(false); setNombre(perfil?.nombre ?? user?.displayName ?? ''); }}
            onGuardar={guardarNombre}
            onChange={setNombre}
            placeholder="Tu nombre completo"
          />

          {/* Correo */}
          <View style={[styles.campo, styles.separador]}>
            <View style={styles.campoIcono}>
              <Ionicons name="mail-outline" size={17} color={Brand.primary} />
            </View>
            <View style={styles.campoInfo}>
              <Text style={styles.campoLabel}>Correo</Text>
              <Text style={styles.campoValor}>{user?.email}</Text>
            </View>
          </View>

          {/* Teléfono */}
          <CampoEditable
            icono="call-outline"
            label="Teléfono"
            valor={editandoTel ? telefono : (perfil?.telefono || 'Sin número')}
            editando={editandoTel}
            guardando={guardandoTel}
            onEditar={() => setEditandoTel(true)}
            onCancelar={() => { setEditandoTel(false); setTelefono(perfil?.telefono ?? ''); }}
            onGuardar={guardarTelefono}
            onChange={setTelefono}
            placeholder="Ej: 8888-8888"
            keyboardType="phone-pad"
            separador
          />
        </View>

        {/* Seguridad */}
        {esEmailUser && (
          <View style={styles.seccion}>
            <Text style={styles.seccionLabel}>Seguridad</Text>
            <Pressable
              style={({ pressed }) => [styles.campo, pressed && { backgroundColor: '#F8FAFA' }]}
              onPress={cambiarContrasena}>
              <View style={[styles.campoIcono, { backgroundColor: Brand.accent + '20' }]}>
                <Ionicons name="key-outline" size={17} color="#B07D00" />
              </View>
              <View style={styles.campoInfo}>
                <Text style={styles.campoLabel}>Contraseña</Text>
                <Text style={styles.campoValor}>Enviar correo para cambiarla</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={Brand.onLightMuted} />
            </Pressable>
          </View>
        )}

        {/* Cuenta */}
        <View style={styles.seccion}>
          <Text style={styles.seccionLabel}>Cuenta</Text>
          <View style={styles.campo}>
            <View style={[styles.campoIcono, { backgroundColor: '#F0F4F3' }]}>
              <Ionicons name={esEmailUser ? 'mail' : 'logo-google'} size={17} color={Brand.onLightMuted} />
            </View>
            <View style={styles.campoInfo}>
              <Text style={styles.campoLabel}>Método de acceso</Text>
              <Text style={styles.campoValor}>{esEmailUser ? 'Email y contraseña' : 'Google'}</Text>
            </View>
          </View>
        </View>

        {/* Ayuda y soporte */}
        <View style={styles.seccion}>
          <Text style={styles.seccionLabel}>Ayuda y soporte</Text>
          <Pressable
            style={({ pressed }) => [styles.campo, pressed && { backgroundColor: '#F8FAFA' }]}
            onPress={() => router.push('/ayuda' as any)}>
            <View style={[styles.campoIcono, { backgroundColor: Brand.accent + '20' }]}>
              <Ionicons name="help-circle-outline" size={17} color={Brand.accentText} />
            </View>
            <View style={styles.campoInfo}>
              <Text style={styles.campoLabel}>Ayuda</Text>
              <Text style={styles.campoValor}>Preguntas frecuentes y soporte</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Brand.onLightMuted} />
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.campo, styles.separador, pressed && { backgroundColor: '#F8FAFA' }]}
            onPress={() => router.push('/acerca-de' as any)}>
            <View style={[styles.campoIcono, { backgroundColor: Brand.primary + '15' }]}>
              <Ionicons name="information-circle-outline" size={17} color={Brand.primary} />
            </View>
            <View style={styles.campoInfo}>
              <Text style={styles.campoLabel}>Acerca de</Text>
              <Text style={styles.campoValor}>Información de la app y versión</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Brand.onLightMuted} />
          </Pressable>
        </View>

        {/* Cerrar sesión */}
        <Pressable
          style={({ pressed }) => [styles.logoutBtn, pressed && { opacity: 0.85 }]}
          onPress={confirmarCerrarSesion}>
          <Ionicons name="log-out-outline" size={18} color={Brand.danger} />
          <Text style={styles.logoutText}>Cerrar sesión</Text>
        </Pressable>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

function StatBox({ icono, valor, label, color }: { icono: any; valor: number; label: string; color: string }) {
  return (
    <View style={[styles.statBox, { borderColor: color + '30' }]}>
      <View style={[styles.statIcono, { backgroundColor: color + '18' }]}>
        <Ionicons name={icono} size={18} color={color} />
      </View>
      <Text style={[styles.statValor, { color }]}>{valor}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function CampoEditable({
  icono, label, valor, editando, guardando, onEditar, onCancelar, onGuardar, onChange, placeholder, keyboardType, separador,
}: {
  icono: any; label: string; valor: string; editando: boolean; guardando: boolean;
  onEditar: () => void; onCancelar: () => void; onGuardar: () => void;
  onChange: (v: string) => void; placeholder: string; keyboardType?: any; separador?: boolean;
}) {
  return (
    <View style={[styles.campo, separador && styles.separador]}>
      <View style={styles.campoIcono}>
        <Ionicons name={icono} size={17} color={Brand.primary} />
      </View>
      <View style={styles.campoInfo}>
        <Text style={styles.campoLabel}>{label}</Text>
        {editando ? (
          <View style={styles.editRow}>
            <TextInput
              style={styles.editInput}
              value={valor}
              onChangeText={onChange}
              placeholder={placeholder}
              placeholderTextColor={Brand.onLightMuted}
              keyboardType={keyboardType}
              autoFocus
              autoCapitalize={keyboardType ? 'none' : 'words'}
            />
            <Pressable onPress={onGuardar} disabled={guardando} style={styles.saveBtn}>
              {guardando
                ? <ActivityIndicator size="small" color={Brand.white} />
                : <Ionicons name="checkmark" size={16} color={Brand.white} />}
            </Pressable>
            <Pressable onPress={onCancelar} style={styles.cancelBtn}>
              <Ionicons name="close" size={16} color={Brand.onLightMuted} />
            </Pressable>
          </View>
        ) : (
          <View style={styles.editRow}>
            <Text style={styles.campoValor}>{valor}</Text>
            <Pressable onPress={onEditar} style={styles.editBtn}>
              <Ionicons name="pencil-outline" size={15} color={Brand.primary} />
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.cream },
  pageHeader: { paddingHorizontal: 20, paddingVertical: 14 },
  titulo: { fontSize: 22, fontWeight: '800', color: Brand.onLight },
  scroll: { paddingHorizontal: 20 },

  // Avatar
  avatarSection: { alignItems: 'center', paddingBottom: 24, gap: 6 },
  avatar: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: Brand.primaryDark,
    alignItems: 'center', justifyContent: 'center', marginBottom: 6,
    shadowColor: Brand.primaryDark, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  avatarText: { fontSize: 32, fontWeight: '800', color: Brand.white, letterSpacing: 1 },
  nombreDisplay: { fontSize: 20, fontWeight: '700', color: Brand.onLight },
  emailDisplay: { fontSize: 13, color: Brand.onLightMuted },
  pillsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 4 },
  adminPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Brand.accentSoft, paddingVertical: 4, paddingHorizontal: 12, borderRadius: 20,
  },
  adminPillText: { color: Brand.primaryDark, fontWeight: '700', fontSize: 12 },
  fechaPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#EAF1F0', paddingVertical: 4, paddingHorizontal: 12, borderRadius: 20,
  },
  fechaPillText: { color: Brand.onLightMuted, fontSize: 12 },

  // Stats
  statsLoading: { padding: 16, alignItems: 'center' },
  statsGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    justifyContent: 'space-between', rowGap: 10,
    padding: 12,
  },
  statBox: {
    width: '48%', alignItems: 'center', gap: 5, paddingVertical: 14, paddingHorizontal: 8,
    borderRadius: 14, borderWidth: 1, backgroundColor: Brand.white,
  },
  statIcono: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  statValor: { fontSize: 24, fontWeight: '800' },
  statLabel: { fontSize: 11, color: Brand.onLightMuted, textAlign: 'center', fontWeight: '600' },

  // Tarjeta de organizador
  orgCard: {
    backgroundColor: Brand.primaryDark, borderRadius: 18, padding: 18, marginBottom: 14,
    shadowColor: Brand.primaryDeep, shadowOpacity: 0.2, shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 }, elevation: 5,
  },
  orgTop: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  orgLabel: { fontSize: 10, fontWeight: '800', color: Brand.onDarkMuted, letterSpacing: 0.8 },
  orgRecaudado: { fontSize: 30, fontWeight: '900', color: Brand.accent },
  orgRecaudadoLabel: { fontSize: 12, color: Brand.onDarkMuted, marginTop: 2 },
  orgFooter: {
    flexDirection: 'row', alignItems: 'center', marginTop: 16,
    borderTopWidth: 1, borderTopColor: Brand.white + '1A', paddingTop: 14,
  },
  orgFooterItem: { flex: 1, alignItems: 'center', gap: 2 },
  orgFooterDiv: { width: 1, height: 32, backgroundColor: Brand.white + '1A' },
  orgFooterValor: { fontSize: 20, fontWeight: '900', color: Brand.white },
  orgFooterLabel: { fontSize: 11, color: Brand.onDarkMuted },

  // Sección
  seccion: {
    backgroundColor: Brand.white, borderRadius: 18, marginBottom: 14,
    borderWidth: 1, borderColor: '#E7EEED', overflow: 'hidden',
  },
  seccionLabel: {
    fontSize: 11, fontWeight: '700', color: Brand.onLightMuted,
    textTransform: 'uppercase', letterSpacing: 0.8,
    paddingHorizontal: 14, paddingTop: 12, paddingBottom: 6,
  },

  // Campo
  campo: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 13, gap: 12,
  },
  separador: { borderTopWidth: 1, borderTopColor: '#F0F4F3' },
  campoIcono: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: Brand.primary + '15', alignItems: 'center', justifyContent: 'center',
  },
  campoInfo: { flex: 1, gap: 2 },
  campoLabel: { fontSize: 11, color: Brand.onLightMuted, fontWeight: '600' },
  campoValor: { fontSize: 14, color: Brand.onLight, fontWeight: '500' },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  editInput: {
    flex: 1, fontSize: 14, color: Brand.onLight,
    borderBottomWidth: 1.5, borderBottomColor: Brand.primary, paddingVertical: 2,
  },
  saveBtn: {
    width: 30, height: 30, borderRadius: 8,
    backgroundColor: Brand.primary, alignItems: 'center', justifyContent: 'center',
  },
  cancelBtn: {
    width: 30, height: 30, borderRadius: 8,
    backgroundColor: '#EAF1F0', alignItems: 'center', justifyContent: 'center',
  },
  editBtn: { padding: 4 },

  // Logout
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: Brand.white, borderRadius: 18, paddingVertical: 16,
    borderWidth: 1, borderColor: '#FAE0E0', marginBottom: 14,
  },
  logoutText: { fontSize: 15, fontWeight: '700', color: Brand.danger },
});
