import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppInfo, Brand } from '@/constants/brand';

/** Preguntas frecuentes de la app. */
const FAQS: { pregunta: string; respuesta: string }[] = [
  {
    pregunta: '¿Cómo compro un número?',
    respuesta:
      'Entrá a la rifa que te guste, elegí uno o varios números libres en la grilla y tocá "Continuar al resumen". Luego completás tus datos y pagás con tarjeta o SINPE Móvil.',
  },
  {
    pregunta: '¿Qué métodos de pago hay?',
    respuesta:
      'Podés pagar con tarjeta de crédito/débito (el número queda confirmado al instante) o con SINPE Móvil, subiendo la captura de la transferencia. El pago por SINPE queda pendiente hasta que el organizador lo verifique.',
  },
  {
    pregunta: '¿Cómo sé si mi pago por SINPE fue aceptado?',
    respuesta:
      'El organizador revisa la captura y marca el número como pagado. Podés ver el estado de cada número en la pestaña "Boletos".',
  },
  {
    pregunta: '¿Dónde veo mis números comprados?',
    respuesta:
      'En la pestaña "Boletos" aparecen todos los números que has comprado, con su rifa, estado de pago y código QR del comprobante.',
  },
  {
    pregunta: '¿Cómo se elige al ganador?',
    respuesta:
      'Cuando la rifa se cierra, el organizador realiza el sorteo desde la app. El número ganador y sus datos quedan visibles para todos en la pantalla de la rifa.',
  },
  {
    pregunta: '¿Cómo creo mi propia rifa?',
    respuesta:
      'Desde tu Perfil, en la sección "Organizador", tocá "Crear rifa". Definís el premio, el precio por número y la cantidad total de números.',
  },
  {
    pregunta: '¿Puedo recuperar mi cuenta si olvido la contraseña?',
    respuesta:
      'Sí. En la pantalla de inicio de sesión tocá "¿Olvidaste tu contraseña?" y te enviaremos un correo para restablecerla.',
  },
];

export default function AyudaScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [abierta, setAbierta] = useState<number | null>(0);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* NavBar */}
      <View style={styles.navBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Brand.onLight} />
        </Pressable>
        <Text style={styles.navTitulo} numberOfLines={1}>Ayuda</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroIcono}>
            <Ionicons name="help-buoy" size={28} color={Brand.accent} />
          </View>
          <Text style={styles.heroTitulo}>Preguntas frecuentes</Text>
          <Text style={styles.heroSub}>
            Resolvé tus dudas sobre cómo comprar, pagar y participar en {AppInfo.name}.
          </Text>
        </View>

        {/* Acordeón de FAQs */}
        <View style={styles.seccion}>
          {FAQS.map((faq, i) => {
            const activa = abierta === i;
            return (
              <Pressable
                key={i}
                style={[styles.faqItem, i > 0 && styles.separador]}
                onPress={() => setAbierta(activa ? null : i)}>
                <View style={styles.faqHeader}>
                  <Text style={styles.faqPregunta}>{faq.pregunta}</Text>
                  <Ionicons
                    name={activa ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={Brand.onLightMuted}
                  />
                </View>
                {activa && <Text style={styles.faqRespuesta}>{faq.respuesta}</Text>}
              </Pressable>
            );
          })}
        </View>

        {/* Contacto de soporte */}
        <View style={styles.contactoCard}>
          <View style={styles.contactoIcono}>
            <Ionicons name="chatbubbles-outline" size={20} color={Brand.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.contactoTitulo}>¿No encontraste tu respuesta?</Text>
            <Text style={styles.contactoSub}>Escribinos a soporte@tombolitas.cr y te ayudamos.</Text>
          </View>
        </View>

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

  // Hero
  hero: { alignItems: 'center', gap: 8, marginBottom: 20 },
  heroIcono: {
    width: 64, height: 64, borderRadius: 20,
    backgroundColor: Brand.accent + '18',
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  heroTitulo: { fontSize: 22, fontWeight: '800', color: Brand.onLight },
  heroSub: { fontSize: 14, color: Brand.onLightMuted, textAlign: 'center', lineHeight: 20 },

  // Sección / acordeón
  seccion: {
    backgroundColor: Brand.white, borderRadius: 18, marginBottom: 14,
    borderWidth: 1, borderColor: '#E7EEED', overflow: 'hidden',
  },
  separador: { borderTopWidth: 1, borderTopColor: '#F0F4F3' },
  faqItem: { paddingHorizontal: 16, paddingVertical: 16 },
  faqHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  faqPregunta: { flex: 1, fontSize: 15, fontWeight: '700', color: Brand.onLight },
  faqRespuesta: { fontSize: 14, color: Brand.onLightMuted, lineHeight: 21, marginTop: 10 },

  // Contacto
  contactoCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Brand.white, borderRadius: 18, padding: 16,
    borderWidth: 1, borderColor: '#E7EEED',
  },
  contactoIcono: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: Brand.primary + '15',
    alignItems: 'center', justifyContent: 'center',
  },
  contactoTitulo: { fontSize: 14, fontWeight: '700', color: Brand.onLight },
  contactoSub: { fontSize: 13, color: Brand.onLightMuted, marginTop: 2, lineHeight: 18 },
});
