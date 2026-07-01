import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

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

// 3. Función simplificada para disparar alertas 
export async function enviarNotificacion(titulo: string, mensaje: string) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: titulo,
      body: mensaje,
    },
    trigger: null, // trigger nulo lanza la alerta inmediatamente
  });
}