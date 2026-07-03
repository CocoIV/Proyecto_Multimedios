// Conexión central con Firebase.
// Importa desde aquí en el resto de la app: import { auth, db } from '@/config/firebase'

import AsyncStorage from "@react-native-async-storage/async-storage";
import { initializeApp } from "firebase/app";
// @ts-ignore — getReactNativePersistence no está en los tipos de la build web, pero existe en runtime.
import { getAuth, getReactNativePersistence, initializeAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { Platform } from "react-native";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDqZlibXLfB9mmKFCxn7drDqm21Gm9k-ZA",
  authDomain: "proyecto-rifas-e912b.firebaseapp.com",
  projectId: "proyecto-rifas-e912b",
  storageBucket: "proyecto-rifas-e912b.firebasestorage.app",
  messagingSenderId: "754803091254",
  appId: "1:754803091254:web:f81273dd62ef3a55eab597"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Auth: en móvil usamos AsyncStorage para que la sesión persista entre reinicios.
// En web, getAuth ya persiste en el almacenamiento del navegador.
export const auth =
  Platform.OS === 'web'
    ? getAuth(app)
    : initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });

export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;
