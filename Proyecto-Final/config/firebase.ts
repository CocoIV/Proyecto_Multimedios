// Conexión central con Firebase.
// Importa desde aquí en el resto de la app: import { auth, db } from '@/config/firebase'

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

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

// Servicios listos para usar en toda la app.
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;
