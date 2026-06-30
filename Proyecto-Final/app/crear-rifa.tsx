import { Ionicons } from '@expo/vector-icons';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { useRouter } from 'expo-router';
import { useState } from 'react';
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

import { db } from '@/config/firebase';
import { Brand } from '@/constants/brand';
import { useAuth } from '@/context/auth';

const OPCIONES_NUMEROS = [50, 100, 200, 500];

export default function CrearRifaScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, perfil } = useAuth();

  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [premio, setPremio] = useState('');
  const [precio, setPrecio] = useState('');
  const [totalNumeros, setTotalNumeros] = useState(100);
  const [guardando, setGuardando] = useState(false);

  if (perfil?.rol !== 'admin') {
    return (
      <View style={[styles.root, { paddingTop: insets.top }, styles.center]}>
        <Ionicons name="lock-closed-outline" size={44} color={Brand.onLightMuted} />
        <Text style={styles.sinPermiso}>Solo los administradores pueden crear rifas.</Text>
      </View>
    );
  }

  async function crearRifa() {
    if (!titulo.trim()) return Alert.alert('Falta el título', 'Poné un nombre a la rifa.');
    if (!premio.trim()) return Alert.alert('Falta el premio', 'Describí qué se sortea.');
    const precioNum = Number(precio.replace(/[^0-9]/g, ''));
    if (!precioNum || precioNum <= 0) return Alert.alert('Precio inválido', 'Ingresá el precio por número en colones.');

    setGuardando(true);
    try {
      await addDoc(collection(db, 'rifas'), {
        titulo: titulo.trim(),
        descripcion: descripcion.trim(),
        premio: premio.trim(),
        precio: precioNum,
        total_numeros: totalNumeros,
        vendidos: 0,
        estado: 'activa',
        fecha_sorteo: null,
        creado_en: serverTimestamp(),
        creado_por_uid: user?.uid ?? '',
        creado_por_nombre: perfil?.nombre ?? user?.displayName ?? '',
      });
      if (Platform.OS === 'web') {
        window.alert(`¡Rifa creada! "${titulo.trim()}" ya está disponible.`);
        router.back();
      } else {
        Alert.alert('¡Rifa creada!', `"${titulo.trim()}" ya está disponible.`, [
          { text: 'OK', onPress: () => router.back() },
        ]);
      }
    } catch (e: any) {
      console.error('Error creando rifa:', e.code, e.message, e);
      const msg = 'No se pudo crear la rifa. Revisá la consola para más detalles.';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Error', msg);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={[styles.navBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Brand.onLight} />
        </Pressable>
        <Text style={styles.navTitulo}>Nueva Rifa</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>

        <Campo label="Título de la rifa" requerido>
          <TextInput
            style={styles.input}
            placeholder="Ej: Rifa de Navidad 2025"
            placeholderTextColor={Brand.onLightMuted}
            value={titulo}
            onChangeText={setTitulo}
            maxLength={80}
          />
        </Campo>

        <Campo label="Premio" requerido>
          <TextInput
            style={styles.input}
            placeholder="Ej: iPhone 15, Moto Honda, ₡500.000..."
            placeholderTextColor={Brand.onLightMuted}
            value={premio}
            onChangeText={setPremio}
            maxLength={120}
          />
        </Campo>

        <Campo label="Descripción (opcional)">
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Información adicional sobre la rifa..."
            placeholderTextColor={Brand.onLightMuted}
            value={descripcion}
            onChangeText={setDescripcion}
            multiline
            numberOfLines={3}
            maxLength={300}
          />
        </Campo>

        <Campo label="Precio por número (₡)" requerido>
          <TextInput
            style={styles.input}
            placeholder="Ej: 500"
            placeholderTextColor={Brand.onLightMuted}
            value={precio}
            onChangeText={setPrecio}
            keyboardType="numeric"
          />
        </Campo>

        <Campo label="Cantidad de números">
          <View style={styles.opcionesRow}>
            {OPCIONES_NUMEROS.map(op => (
              <Pressable
                key={op}
                style={[styles.opcionBtn, totalNumeros === op && styles.opcionActiva]}
                onPress={() => setTotalNumeros(op)}>
                <Text style={[styles.opcionText, totalNumeros === op && styles.opcionTextActiva]}>
                  {op}
                </Text>
              </Pressable>
            ))}
          </View>
        </Campo>

        <View style={styles.resumen}>
          <Ionicons name="information-circle-outline" size={16} color={Brand.primary} />
          <Text style={styles.resumenText}>
            Se crearán {totalNumeros} números del 1 al {totalNumeros} a ₡{precio || '0'} cada uno.
            {precio ? ` Total posible: ₡${(totalNumeros * Number(precio.replace(/[^0-9]/g, ''))).toLocaleString('es-CR')}.` : ''}
          </Text>
        </View>

        <Pressable
          style={({ pressed }) => [styles.crearBtn, pressed && { opacity: 0.88 }, guardando && { opacity: 0.7 }]}
          onPress={crearRifa}
          disabled={guardando}>
          {guardando
            ? <ActivityIndicator color={Brand.white} />
            : <>
                <Ionicons name="add-circle-outline" size={20} color={Brand.white} />
                <Text style={styles.crearBtnText}>Crear rifa</Text>
              </>
          }
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Campo({ label, requerido, children }: { label: string; requerido?: boolean; children: React.ReactNode }) {
  return (
    <View style={styles.campo}>
      <Text style={styles.campoLabel}>
        {label}{requerido ? <Text style={styles.requerido}> *</Text> : ''}
      </Text>
      {children}
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
    gap: 12,
  },
  sinPermiso: {
    fontSize: 15,
    color: Brand.onLightMuted,
    textAlign: 'center',
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
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
    fontSize: 17,
    fontWeight: '700',
    color: Brand.onLight,
  },
  scroll: {
    padding: 20,
    gap: 4,
  },
  campo: {
    gap: 8,
    marginBottom: 16,
  },
  campoLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Brand.onLight,
  },
  requerido: {
    color: Brand.danger,
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
    minHeight: 80,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  opcionesRow: {
    flexDirection: 'row',
    gap: 10,
  },
  opcionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: Brand.white,
    borderWidth: 1.5,
    borderColor: '#E2E8E7',
  },
  opcionActiva: {
    backgroundColor: Brand.primary,
    borderColor: Brand.primary,
  },
  opcionText: {
    fontSize: 15,
    fontWeight: '700',
    color: Brand.onLightMuted,
  },
  opcionTextActiva: {
    color: Brand.white,
  },
  resumen: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: Brand.primary + '12',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  resumenText: {
    flex: 1,
    fontSize: 13,
    color: Brand.primaryDark,
    lineHeight: 18,
  },
  crearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Brand.primary,
    borderRadius: 16,
    height: 54,
  },
  crearBtnText: {
    color: Brand.white,
    fontSize: 16,
    fontWeight: '700',
  },
});
