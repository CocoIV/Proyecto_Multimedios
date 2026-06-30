// Script temporal para verificar la conexión con Firebase / Firestore.
// Ejecutar: node scripts/verify-firebase.mjs
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDqZlibXLfB9mmKFCxn7drDqm21Gm9k-ZA",
  authDomain: "proyecto-rifas-e912b.firebaseapp.com",
  projectId: "proyecto-rifas-e912b",
  storageBucket: "proyecto-rifas-e912b.firebasestorage.app",
  messagingSenderId: "754803091254",
  appId: "1:754803091254:web:f81273dd62ef3a55eab597",
};

try {
  const app = initializeApp(firebaseConfig);
  console.log("✅ App de Firebase inicializada. Proyecto:", app.options.projectId);

  const db = getFirestore(app);
  console.log("⏳ Intentando leer una colección de prueba ('test')...");

  const snap = await getDocs(collection(db, "test"));
  console.log(`✅ Conexión a Firestore OK. Documentos en 'test': ${snap.size}`);
  process.exit(0);
} catch (err) {
  console.error("❌ Error de conexión:");
  console.error("   code:", err.code);
  console.error("   message:", err.message);
  process.exit(1);
}
