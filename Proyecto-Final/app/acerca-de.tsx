import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppInfo, Brand } from '@/constants/brand';

const VERSION = '1.0.0';

/** Lo que ofrece la app, en tarjetas. */
const CARACTERISTICAS: { icono: any; titulo: string; texto: string; color: string }[] = [
  {
    icono: 'location',
    titulo: 'Rifas cerca de vos',
    texto: 'Descubrí rifas de tu comunidad en un mapa interactivo.',
    color: Brand.primary,
  },
  {
    icono: 'card',
    titulo: 'Pago fácil y seguro',
    texto: 'Comprá con tarjeta o SINPE Móvil en pocos toques.',
    color: Brand.accent,
  },
  {
    icono: 'trophy',
    titulo: 'Sorteos transparentes',
    texto: 'El ganador queda visible para toda la comunidad.',
    color: Brand.red,
  },
];

export default function AcercaDeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* NavBar */}
      <View style={styles.navBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Brand.onLight} />
        </Pressable>
        <Text style={styles.navTitulo} numberOfLines={1}>Acerca de</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Marca */}
        <View style={styles.marca}>
          <View style={styles.logo}>
            <Ionicons name="ticket" size={38} color={Brand.accent} />
          </View>
          <Text style={styles.nombre}>{AppInfo.name}</Text>
          <Text style={styles.tagline}>{AppInfo.tagline}</Text>
          <View style={styles.versionPill}>
            <Text style={styles.versionText}>Versión {VERSION}</Text>
          </View>
        </View>

        {/* Descripción */}
        <View style={styles.card}>
          <Text style={styles.descripcion}>
            {AppInfo.name} conecta a organizadores y compradores para crear y jugar
            rifas locales de forma simple, cercana y confiable. {AppInfo.region}.
          </Text>
        </View>

        {/* Características */}
        <View style={styles.seccion}>
          {CARACTERISTICAS.map((c, i) => (
            <View key={i} style={[styles.featureItem, i > 0 && styles.separador]}>
              <View style={[styles.featureIcono, { backgroundColor: c.color + '18' }]}>
                <Ionicons name={c.icono} size={20} color={c.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.featureTitulo}>{c.titulo}</Text>
                <Text style={styles.featureTexto}>{c.texto}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Enlaces */}
        <View style={styles.seccion}>
          <Pressable
            style={({ pressed }) => [styles.linkItem, pressed && { backgroundColor: '#F8FAFA' }]}
            onPress={() => router.push('/ayuda' as any)}>
            <View style={[styles.linkIcono, { backgroundColor: Brand.accent + '20' }]}>
              <Ionicons name="help-circle-outline" size={17} color={Brand.accentText} />
            </View>
            <Text style={styles.linkLabel}>Ayuda y preguntas frecuentes</Text>
            <Ionicons name="chevron-forward" size={16} color={Brand.onLightMuted} />
          </Pressable>
        </View>

        {/* Créditos */}
        <Text style={styles.creditos}>
          Hecho con 💛 en Costa Rica{'\n'}© {new Date().getFullYear()} {AppInfo.name}
        </Text>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.cream },

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
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: '#F0F4F3',
    alignItems: 'center', justifyContent: 'center',
  },
  navTitulo: {
    flex: 1, textAlign: 'center',
    fontSize: 16, fontWeight: '700', color: Brand.onLight, marginHorizontal: 8,
  },

  scroll: { padding: 20 },

  // Marca
  marca: { alignItems: 'center', gap: 6, marginBottom: 20 },
  logo: {
    width: 88, height: 88, borderRadius: 28,
    backgroundColor: Brand.primaryDark,
    alignItems: 'center', justifyContent: 'center', marginBottom: 6,
    shadowColor: Brand.primaryDark, shadowOpacity: 0.3, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  nombre: { fontSize: 24, fontWeight: '900', color: Brand.onLight },
  tagline: {
    fontSize: 12, fontWeight: '700', color: Brand.onLightMuted,
    letterSpacing: 1, textTransform: 'uppercase',
  },
  versionPill: {
    backgroundColor: '#EAF1F0', paddingVertical: 4, paddingHorizontal: 12,
    borderRadius: 20, marginTop: 6,
  },
  versionText: { fontSize: 12, color: Brand.onLightMuted, fontWeight: '600' },

  // Descripción
  card: {
    backgroundColor: Brand.white, borderRadius: 18, padding: 18, marginBottom: 14,
    borderWidth: 1, borderColor: '#E7EEED',
  },
  descripcion: { fontSize: 14, color: Brand.onLightMuted, lineHeight: 22, textAlign: 'center' },

  // Sección
  seccion: {
    backgroundColor: Brand.white, borderRadius: 18, marginBottom: 14,
    borderWidth: 1, borderColor: '#E7EEED', overflow: 'hidden',
  },
  separador: { borderTopWidth: 1, borderTopColor: '#F0F4F3' },

  // Características
  featureItem: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  featureIcono: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  featureTitulo: { fontSize: 15, fontWeight: '700', color: Brand.onLight },
  featureTexto: { fontSize: 13, color: Brand.onLightMuted, marginTop: 2, lineHeight: 18 },

  // Enlaces
  linkItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 14 },
  linkIcono: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  linkLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: Brand.onLight },

  // Créditos
  creditos: { fontSize: 12, color: Brand.onLightMuted, textAlign: 'center', lineHeight: 18, marginTop: 4 },
});
