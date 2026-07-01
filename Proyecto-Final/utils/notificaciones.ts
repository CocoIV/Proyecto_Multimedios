import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants'; // Agregado para leer el ID del proyecto
import { doc, updateDoc } from 'firebase/firestore'; // Agregado para Firestore
import { db } from '@/config/firebase'; // Asegúrate de que esta ruta apunte a tu config de Firebase

// 1. Configuración global: Configurada para cumplir con todos los requerimientos de tipo de Expo
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true, 
    shouldShowSettingNotification: false,
    shouldShowList: true, 
  }),
});

// 2. Función para pedir permisos 
export async function configurarPermisosNotificaciones() {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Permisos de notificación rechazados.');
    return false;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F71',
    });
  }
  return true;
}

// 3. Función simplificada para disparar alertas locales
export async function enviarNotificacion(titulo: string, mensaje: string) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: titulo,
      body: mensaje,
    },
    trigger: null, 
  });
}

// 4. NUEVO: Función para capturar el Push Token y guardarlo en Firestore
export async function registrarPushTokenEnBaseDatos(uid: string) {
  if (Platform.OS === 'web') return;

  try {
    // Reutilizamos tu función para asegurarnos de tener permisos
    const tienePermisos = await configurarPermisosNotificaciones();
    if (!tienePermisos) return;

    // Obtener el ID del proyecto desde app.json (requerido por Expo SDK moderno)
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    
    // Generar el token único de este celular
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenData.data;

    // Guardar el token en el documento del usuario en Firestore
    const usuarioRef = doc(db, 'usuarios', uid);
    await updateDoc(usuarioRef, {
      expoPushToken: token,
      actualizado_en: new Date()
    });

    console.log('Push Token guardado en Firestore:', token);
  } catch (error) {
    console.error('Error al registrar el token push:', error);
  }
}