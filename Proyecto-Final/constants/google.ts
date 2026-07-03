/**
 * Client IDs de Google OAuth para el login con `expo-auth-session`.
 *
 * Cada plataforma usa un Client ID distinto creado en Google Cloud Console
 * (APIs & Services → Credentials). El proyecto de Firebase ya trae uno "Web"
 * autocreado; los de Android e iOS hay que crearlos a mano.
 *
 * Cómo obtenerlos:
 *  - Web:     Firebase Console → Authentication → Sign-in method → Google → "Web SDK configuration".
 *  - Android: Google Cloud → Credentials → Create OAuth client ID → tipo "Android".
 *             Package name: el `android.package` de app.json (ej: com.tuusuario.proyectofinal)
 *             SHA-1: el fingerprint de tu keystore (para Expo Go/dev build, ver instrucciones abajo).
 *  - iOS:     Google Cloud → Credentials → Create OAuth client ID → tipo "iOS".
 *             Bundle ID: el `ios.bundleIdentifier` de app.json.
 *
 * IMPORTANTE: el login nativo de Google NO funciona en Expo Go con SDK modernos.
 * Necesitás un development build:  npx expo run:android  /  npx expo run:ios
 * (o `eas build --profile development`). En la web sí funciona directo.
 */
export const GOOGLE = {
  webClientId: '754803091254-hvuamdle45tn3i0t81i0r326b7aauk9i.apps.googleusercontent.com',
  androidClientId: '118765398066-sc546pl3fmpjbreab95k5o5diaqdoo1c.apps.googleusercontent.com',
  // TODO: pegá aquí el iOS Client ID cuando lo crees en Google Cloud (solo si vas a correr en iPhone).
  iosClientId: '',
};
