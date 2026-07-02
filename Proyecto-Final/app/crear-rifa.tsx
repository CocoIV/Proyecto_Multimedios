import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

//Importamos tu clase centralizada utils/notificaciones.ts
import { enviarNotificacion } from '@/utils/notificaciones';

import { db } from '@/config/firebase';
import { Brand } from '@/constants/brand';
import { ZONAS } from '@/constants/zonas';
import { useAuth } from '@/context/auth';

/** "01/12/26" -> Date | null (formato DD/MM/AA o DD/MM/AAAA). */
function parseFecha(s: string): Date | null {
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return null;
  const dia = Number(m[1]);
  const mes = Number(m[2]);
  const anio = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  const d = new Date(anio, mes - 1, dia);
  if (isNaN(d.getTime()) || d.getMonth() !== mes - 1 || d.getDate() !== dia) return null;
  return d;
}

/** Va insertando las barras a medida que se escribe. */
function formatearFecha(v: string) {
  const nums = v.replace(/\D/g, '').slice(0, 6);
  const partes = [nums.slice(0, 2), nums.slice(2, 4), nums.slice(4, 6)].filter(Boolean);
  return partes.join('/');
}

export default function CrearRifaScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, perfil } = useAuth();

  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [precio, setPrecio] = useState('');
  const [totalStr, setTotalStr] = useState('100');
  const [zona, setZona] = useState('');
  const [fecha, setFecha] = useState('');
  const [imagen, setImagen] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const precioNum = Number(precio.replace(/[^0-9]/g, ''));
  const totalNum = Number(totalStr.replace(/[^0-9]/g, ''));
  const recaudacion = useMemo(() => precioNum * totalNum, [precioNum, totalNum]);

  async function elegirImagen() {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 10],
      quality: 0.6,
    });
    if (!res.canceled && res.assets?.[0]) {
      setImagen(res.assets[0].uri);
    }
  }

  async function crearRifa() {
    if (!titulo.trim()) return Alert.alert('Falta el premio', 'Poné el nombre del premio.');
    if (!precioNum || precioNum <= 0) return Alert.alert('Precio inválido', 'Ingresá el precio por boleto en colones.');
    if (!totalNum || totalNum <= 0) return Alert.alert('Boletos inválidos', 'Ingresá cuántos boletos tendrá la rifa.');
    if (!zona) return Alert.alert('Falta la zona', 'Elegí la zona donde se hace la rifa.');

    const fechaDate = fecha.trim() ? parseFecha(fecha.trim()) : null;
    if (fecha.trim() && !fechaDate) return Alert.alert('Fecha inválida', 'Usá el formato DD/MM/AA.');

    setGuardando(true);
    try {
      await addDoc(collection(db, 'rifas'), {
        titulo: titulo.trim(),
        descripcion: descripcion.trim(),
        premio: titulo.trim(),
        precio: precioNum,
        total_numeros: totalNum,
        zona: zona.trim(),
        premio_imagen: imagen ?? '',
        vendidos: 0,
        estado: 'activa',
        fecha_sorteo: fechaDate,
        creado_en: serverTimestamp(),
        creado_por_uid: user?.uid ?? '',
        creado_por_nombre: perfil?.nombre ?? user?.displayName ?? '',
      });

      enviarNotificacion(
        '¡Nueva Rifa Creada!',
        `La rifa "${titulo.trim()}" ya está disponible para el público.`
      ).catch(() => {});

      if (Platform.OS === 'web') {
        window.alert(`¡Rifa publicada! "${titulo.trim()}" ya está disponible.`);
        router.back();
      } else {
        Alert.alert('¡Rifa publicada!', `"${titulo.trim()}" ya está disponible.`, [
          { text: 'OK', onPress: () => router.back() },
        ]);
      }
    } catch (e: any) {
      console.error('Error creando rifa:', e.code, e.message, e);
      const msg = 'No se pudo publicar la rifa. Revisá la consola para más detalles.';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Error', msg);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Header verde */}
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Brand.white} />
        </Pressable>
        <Text style={styles.headerTitulo}>Crear Nueva Rifa</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>

        {/* Foto del premio */}
        <Pressable
          onPress={elegirImagen}
          style={[styles.foto, imagen ? styles.fotoConImagen : styles.fotoVacia]}>
          {imagen ? (
            <>
              <Image source={{ uri: imagen }} style={styles.fotoImg} contentFit="cover" />
              <View style={styles.fotoEditar}>
                <Ionicons name="camera" size={15} color={Brand.white} />
                <Text style={styles.fotoEditarText}>Cambiar foto</Text>
              </View>
            </>
          ) : (
            <>
              <Ionicons name="add" size={34} color={Brand.onLightMuted} />
              <Text style={styles.fotoText}>Agregar foto del premio</Text>
            </>
          )}
        </Pressable>

        <Campo label="Nombre del premio">
          <TextInput
            style={styles.input}
            placeholder="Ej: iPhone 15, Moto Honda…"
            placeholderTextColor={Brand.onLightMuted}
            value={titulo}
            onChangeText={setTitulo}
            maxLength={80}
          />
        </Campo>

        <View style={styles.fila}>
          <Campo label="Precio por boleto" style={styles.filaItem}>
            <TextInput
              style={styles.input}
              placeholder="₡ 2.000"
              placeholderTextColor={Brand.onLightMuted}
              value={precio}
              onChangeText={setPrecio}
              keyboardType="numeric"
            />
          </Campo>
          <Campo label="Total boletos" style={styles.filaItem}>
            <TextInput
              style={styles.input}
              placeholder="100"
              placeholderTextColor={Brand.onLightMuted}
              value={totalStr}
              onChangeText={setTotalStr}
              keyboardType="numeric"
            />
          </Campo>
        </View>

        <Campo label="Zona">
          <View style={styles.zonasRow}>
            {ZONAS.map(z => (
              <Pressable
                key={z}
                onPress={() => setZona(z)}
                style={[styles.zonaChip, zona === z && styles.zonaChipActiva]}>
                <Text style={[styles.zonaChipText, zona === z && styles.zonaChipTextActiva]}>{z}</Text>
              </Pressable>
            ))}
          </View>
        </Campo>

        <Campo label="Fecha del sorteo">
          <TextInput
            style={styles.input}
            placeholder="00/00/00"
            placeholderTextColor={Brand.onLightMuted}
            value={fecha}
            onChangeText={t => setFecha(formatearFecha(t))}
            keyboardType="numeric"
            maxLength={8}
          />
        </Campo>

        <Campo label="Descripción del premio">
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Descripción del premio, condiciones, etc."
            placeholderTextColor={Brand.onLightMuted}
            value={descripcion}
            onChangeText={setDescripcion}
            multiline
            numberOfLines={3}
            maxLength={300}
          />
        </Campo>

        <View style={styles.resumen}>
          <Text style={styles.resumenLabel}>Recaudación estimada si se venden todos</Text>
          <Text style={styles.resumenMonto}>
            ₡{recaudacion.toLocaleString('es-CR')}
            <Text style={styles.resumenDetalle}>
              {'  ·  '}{totalNum || 0} boletos × ₡{(precioNum || 0).toLocaleString('es-CR')}
            </Text>
          </Text>
        </View>
      </ScrollView>

      {/* Botón fijo abajo */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          style={({ pressed }) => [styles.publicarBtn, pressed && { opacity: 0.9 }, guardando && { opacity: 0.7 }]}
          onPress={crearRifa}
          disabled={guardando}>
          {guardando
            ? <ActivityIndicator color={Brand.white} />
            : <Text style={styles.publicarText}>Publicar Rifa</Text>
          }
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function Campo({ label, style, children }: { label: string; style?: any; children: React.ReactNode }) {
  return (
    <View style={[styles.campo, style]}>
      <Text style={styles.campoLabel}>{label}</Text>
      {children}
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
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 8,
    backgroundColor: Brand.primaryDark,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Brand.white + '1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitulo: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '800',
    color: Brand.white,
  },
  scroll: {
    padding: 20,
    paddingBottom: 32,
  },

  // Foto del premio
  foto: {
    height: 150,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    overflow: 'hidden',
  },
  fotoVacia: {
    backgroundColor: '#EEEBDD',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: Brand.primary + '55',
    gap: 6,
  },
  fotoConImagen: {
    backgroundColor: Brand.white,
  },
  fotoText: {
    fontSize: 14,
    color: Brand.onLightMuted,
    fontWeight: '600',
  },
  fotoImg: {
    ...StyleSheet.absoluteFillObject,
  },
  fotoEditar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(15,61,46,0.75)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  fotoEditarText: {
    color: Brand.white,
    fontSize: 12,
    fontWeight: '700',
  },

  // Campos
  campo: {
    gap: 8,
    marginBottom: 16,
  },
  campoLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Brand.onLight,
  },
  input: {
    backgroundColor: Brand.white,
    borderWidth: 1.5,
    borderColor: '#E2E8E7',
    borderRadius: 13,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Brand.onLight,
  },
  textArea: {
    minHeight: 90,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  fila: {
    flexDirection: 'row',
    gap: 14,
  },
  filaItem: {
    flex: 1,
  },
  zonasRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  zonaChip: {
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: Brand.white,
    borderWidth: 1.5,
    borderColor: '#E2E8E7',
  },
  zonaChipActiva: {
    backgroundColor: Brand.primary,
    borderColor: Brand.primary,
  },
  zonaChipText: {
    fontSize: 14,
    fontWeight: '700',
    color: Brand.onLightMuted,
  },
  zonaChipTextActiva: {
    color: Brand.white,
  },

  // Resumen
  resumen: {
    backgroundColor: '#EEEBDD',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 4,
    gap: 4,
  },
  resumenLabel: {
    fontSize: 12,
    color: Brand.onLightMuted,
    fontWeight: '600',
  },
  resumenMonto: {
    fontSize: 17,
    fontWeight: '900',
    color: Brand.primary,
  },
  resumenDetalle: {
    fontSize: 13,
    fontWeight: '600',
    color: Brand.onLightMuted,
  },

  // Footer
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: Brand.cream,
    borderTopWidth: 1,
    borderTopColor: Brand.onLight + '10',
  },
  publicarBtn: {
    backgroundColor: Brand.primaryDark,
    borderRadius: 16,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  publicarText: {
    color: Brand.white,
    fontSize: 17,
    fontWeight: '800',
  },
});
