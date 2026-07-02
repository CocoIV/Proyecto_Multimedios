import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppInfo, Brand } from '@/constants/brand';
import { useAuth } from '@/context/auth';

type Paso = 0 | 1 | 2;

/** Tómbola compacta reutilizable para el hero del onboarding. */
function Tombola({ sobreVerde }: { sobreVerde?: boolean }) {
  const linea = sobreVerde ? Brand.cream + '55' : Brand.primary + '30';
  const borde = sobreVerde ? Brand.cream : Brand.primary;
  const fondo = sobreVerde ? Brand.primaryDark : Brand.white;
  return (
    <View style={styles.tombolaWrap}>
      <View style={[styles.esfera, { borderColor: borde, backgroundColor: fondo }]}>
        <View style={[styles.meridianoV, { borderColor: linea }]} />
        <View style={[styles.meridianoH, { backgroundColor: linea }]} />
        <View style={[styles.bola, styles.bolaAmbar]}><Text style={styles.bolaText}>7</Text></View>
        <View style={[styles.bola, styles.bolaRojo]}><Text style={styles.bolaText}>23</Text></View>
        <View style={[styles.bola, styles.bolaNavy]}><Text style={styles.bolaText}>5</Text></View>
      </View>
      <View style={[styles.cuello, { backgroundColor: linea }]} />
      <View style={[styles.base, { backgroundColor: linea }]} />
    </View>
  );
}

function FeatureCard({ icono, color, label }: { icono: any; color: string; label: string }) {
  return (
    <View style={styles.featureCard}>
      <View style={[styles.featureIcono, { backgroundColor: color + '1A' }]}>
        <Ionicons name={icono} size={20} color={color} />
      </View>
      <Text style={styles.featureLabel}>{label}</Text>
    </View>
  );
}

function PasoItem({ num, titulo, desc }: { num: number; titulo: string; desc: string }) {
  return (
    <View style={styles.pasoRow}>
      <View style={styles.pasoNum}>
        <Text style={styles.pasoNumText}>{num}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.pasoTitulo}>{titulo}</Text>
        <Text style={styles.pasoDesc}>{desc}</Text>
      </View>
    </View>
  );
}

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { marcarOnboardingCompleto } = useAuth();
  const [paso, setPaso] = useState<Paso>(0);
  const [pidiendo, setPidiendo] = useState(false);

  async function completar() {
    // Actualiza Firestore + el perfil en memoria; el guardia de rutas
    // detecta el cambio y navega solo a las tabs (evita el bucle).
    await marcarOnboardingCompleto();
    router.replace('/(tabs)');
  }

  async function permitirUbicacion() {
    setPidiendo(true);
    try {
      await Location.requestForegroundPermissionsAsync();
    } catch { /* aunque falle, seguimos */ }
    setPidiendo(false);
    completar();
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Círculos decorativos */}
      <View style={styles.decoVerde} />
      <View style={styles.decoAmbar} />

      {/* ===== PASO 1: Bienvenida por zona ===== */}
      {paso === 0 && (
        <View style={styles.pagina}>
          <View style={styles.heroVerde}>
            <Tombola sobreVerde />
            <Text style={styles.heroTitulo}>Rifas locales y cerca de vos</Text>
          </View>

          <Text style={styles.parrafo}>
            {AppInfo.name} es la plataforma de rifas por zona. Participá en sorteos de
            tu comunidad y apoyá a emprendedores locales.
          </Text>

          <View style={styles.featureRow}>
            <FeatureCard icono="location" color={Brand.red} label="Por zona" />
            <FeatureCard icono="ticket" color={Brand.accent} label="Fácil y seguro" />
            <FeatureCard icono="trophy" color={Brand.primary} label="Gana premios" />
          </View>

          <View style={styles.dots}>
            <View style={[styles.dot, styles.dotActivo]} />
            <View style={styles.dot} />
            <View style={styles.dot} />
          </View>

          <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
            <Pressable style={({ pressed }) => [styles.btnVerde, pressed && { opacity: 0.9 }]} onPress={() => setPaso(1)}>
              <Text style={styles.btnVerdeText}>Siguiente →</Text>
            </Pressable>
            <Pressable onPress={completar}>
              <Text style={styles.saltar}>Saltar introducción</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* ===== PASO 2: Así de fácil participar ===== */}
      {paso === 1 && (
        <View style={styles.pagina}>
          <View style={styles.heroRojo}>
            <View style={styles.pasosBadges}>
              <View style={[styles.pasoBadge, { backgroundColor: Brand.white }]}><Text style={[styles.pasoBadgeText, { color: Brand.red }]}>1</Text></View>
              <View style={[styles.pasoBadge, { backgroundColor: Brand.white }]}><Text style={[styles.pasoBadgeText, { color: Brand.red }]}>2</Text></View>
              <View style={[styles.pasoBadge, { backgroundColor: Brand.accent }]}><Text style={[styles.pasoBadgeText, { color: Brand.white }]}>3</Text></View>
            </View>
            <Text style={styles.heroTitulo}>Así de fácil{'\n'}participar</Text>
          </View>

          <View style={styles.pasosLista}>
            <PasoItem num={1} titulo="Elegí una rifa" desc="Explorá las rifas activas cerca de vos y elegí tu favorita." />
            <PasoItem num={2} titulo="Comprá un boleto" desc="Pagá con tarjeta o SINPE Móvil y asegurá tus números." />
            <PasoItem num={3} titulo="Ganá y celebrá" desc="Esperá el sorteo en vivo. ¡Así de sencillo!" />
          </View>

          <View style={styles.dots}>
            <View style={styles.dot} />
            <View style={[styles.dot, styles.dotActivo]} />
            <View style={styles.dot} />
          </View>

          <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
            <Pressable style={({ pressed }) => [styles.btnRojo, pressed && { opacity: 0.9 }]} onPress={() => setPaso(2)}>
              <Text style={styles.btnRojoText}>¡Empezar ahora!</Text>
            </Pressable>
            <Pressable onPress={() => setPaso(0)}>
              <Text style={styles.saltar}>← Volver</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* ===== PASO 3: Permisos de ubicación ===== */}
      {paso === 2 && (
        <View style={styles.pagina}>
          <View style={styles.radarWrap}>
            <View style={styles.radarAura3} />
            <View style={styles.radarAura2} />
            <View style={styles.radarAura1} />
            <View style={styles.radarPin}>
              <Ionicons name="location" size={30} color={Brand.white} />
            </View>
          </View>

          <Text style={styles.tituloOscuro}>¿Dónde estás?</Text>
          <Text style={styles.parrafoCentro}>
            Necesitamos tu ubicación para mostrarte las rifas disponibles en tu zona y
            comunidad. Para mantener tus permisos a salvo, podés cambiarlo cuando querás.
          </Text>

          <View style={styles.permisoCard}>
            <Ionicons name="shield-checkmark-outline" size={18} color={Brand.primary} />
            <Text style={styles.permisoCardText}>
              {AppInfo.name} quiere acceder a tu ubicación
            </Text>
          </View>

          <View style={styles.dots}>
            <View style={styles.dot} />
            <View style={styles.dot} />
            <View style={[styles.dot, styles.dotActivo]} />
          </View>

          <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
            <Pressable
              style={({ pressed }) => [styles.btnVerde, pressed && { opacity: 0.9 }]}
              onPress={permitirUbicacion}
              disabled={pidiendo}>
              <Text style={styles.btnVerdeText}>{pidiendo ? 'Procesando…' : 'Permitir'}</Text>
            </Pressable>
            <Pressable onPress={completar} disabled={pidiendo}>
              <Text style={styles.saltar}>No permitir por ahora</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.cream },
  pagina: { flex: 1, paddingHorizontal: 24 },
  decoVerde: {
    position: 'absolute', width: 200, height: 200, borderRadius: 100,
    backgroundColor: Brand.primary + '14', top: -60, right: -50,
  },
  decoAmbar: {
    position: 'absolute', width: 160, height: 160, borderRadius: 80,
    backgroundColor: Brand.accent + '14', bottom: 120, left: -60,
  },

  // --- Hero verde (paso 1) ---
  heroVerde: {
    backgroundColor: Brand.primary,
    borderRadius: 32,
    paddingTop: 28, paddingBottom: 28, paddingHorizontal: 20,
    alignItems: 'center', gap: 18,
    marginTop: 8,
    shadowColor: Brand.primaryDeep, shadowOpacity: 0.3, shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 }, elevation: 6,
  },
  heroTitulo: {
    color: Brand.cream, fontSize: 30, fontWeight: '800',
    textAlign: 'center', lineHeight: 36,
  },

  // --- Hero rojo (paso 2) ---
  heroRojo: {
    backgroundColor: Brand.red,
    borderRadius: 32,
    paddingVertical: 30, paddingHorizontal: 20,
    alignItems: 'center', gap: 20,
    marginTop: 8,
    shadowColor: Brand.red, shadowOpacity: 0.35, shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 }, elevation: 6,
  },
  pasosBadges: { flexDirection: 'row', gap: 12 },
  pasoBadge: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center',
  },
  pasoBadgeText: { fontSize: 18, fontWeight: '800' },

  // --- Tómbola ---
  tombolaWrap: { alignItems: 'center' },
  esfera: {
    width: 130, height: 130, borderRadius: 65,
    borderWidth: 3, alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  meridianoV: { position: 'absolute', width: 64, height: 130, borderRadius: 32, borderWidth: 2 },
  meridianoH: { position: 'absolute', width: 130, height: 2 },
  bola: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center', position: 'absolute',
  },
  bolaAmbar: { backgroundColor: Brand.accent, top: 26, left: 28 },
  bolaRojo: { backgroundColor: Brand.red, top: 20, right: 26 },
  bolaNavy: { backgroundColor: Brand.onLight, bottom: 22, alignSelf: 'center' },
  bolaText: { color: Brand.white, fontWeight: '800', fontSize: 13 },
  cuello: { width: 14, height: 18, marginTop: -2 },
  base: { width: 80, height: 10, borderRadius: 5, marginTop: 2 },

  // --- Textos ---
  parrafo: {
    fontSize: 15, color: Brand.onLightMuted, textAlign: 'center',
    lineHeight: 22, marginTop: 24, paddingHorizontal: 8,
  },
  parrafoCentro: {
    fontSize: 15, color: Brand.onLightMuted, textAlign: 'center',
    lineHeight: 22, marginTop: 12, paddingHorizontal: 12,
  },
  tituloOscuro: {
    fontSize: 30, fontWeight: '800', color: Brand.onLight,
    textAlign: 'center', marginTop: 24,
  },

  // --- Feature cards (paso 1) ---
  featureRow: { flexDirection: 'row', gap: 12, marginTop: 28, justifyContent: 'center' },
  featureCard: {
    flex: 1, backgroundColor: Brand.white, borderRadius: 16,
    paddingVertical: 16, alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: Brand.onLight + '14',
    shadowColor: Brand.onLight, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2,
  },
  featureIcono: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  featureLabel: { fontSize: 11, fontWeight: '600', color: Brand.onLight, textAlign: 'center' },

  // --- Pasos lista (paso 2) ---
  pasosLista: { marginTop: 28, gap: 18 },
  pasoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  pasoNum: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: Brand.red,
    alignItems: 'center', justifyContent: 'center',
  },
  pasoNumText: { color: Brand.white, fontWeight: '800', fontSize: 16 },
  pasoTitulo: { fontSize: 16, fontWeight: '700', color: Brand.onLight },
  pasoDesc: { fontSize: 13, color: Brand.onLightMuted, lineHeight: 19, marginTop: 2 },

  // --- Radar (paso 3) ---
  radarWrap: { alignItems: 'center', justifyContent: 'center', height: 220, marginTop: 12 },
  radarAura1: { position: 'absolute', width: 120, height: 120, borderRadius: 60, backgroundColor: Brand.primary + '20' },
  radarAura2: { position: 'absolute', width: 170, height: 170, borderRadius: 85, backgroundColor: Brand.primary + '12' },
  radarAura3: { position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: Brand.primary + '08' },
  radarPin: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: Brand.red,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Brand.red, shadowOpacity: 0.4, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 6,
  },
  permisoCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Brand.white, borderRadius: 14, padding: 14, marginTop: 24,
    borderWidth: 1, borderColor: Brand.onLight + '14',
  },
  permisoCardText: { flex: 1, fontSize: 13, color: Brand.onLight, fontWeight: '600' },

  // --- Dots ---
  dots: { flexDirection: 'row', gap: 8, justifyContent: 'center', marginTop: 'auto', paddingTop: 24 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Brand.onLight + '20' },
  dotActivo: { width: 24, backgroundColor: Brand.primary },

  // --- Footer / botones ---
  footer: { gap: 14, marginTop: 20, alignItems: 'center' },
  btnVerde: {
    width: '100%', backgroundColor: Brand.primary, borderRadius: 18, height: 56,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Brand.primary, shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 6,
  },
  btnVerdeText: { color: Brand.white, fontSize: 17, fontWeight: '700' },
  btnRojo: {
    width: '100%', backgroundColor: Brand.red, borderRadius: 18, height: 56,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Brand.red, shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 6,
  },
  btnRojoText: { color: Brand.white, fontSize: 17, fontWeight: '700' },
  saltar: { fontSize: 13, color: Brand.onLightMuted, fontWeight: '500' },
});
