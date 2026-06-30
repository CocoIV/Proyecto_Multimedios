// Siembra la estructura de la base de datos en Firestore con datos de ejemplo.
// En Firestore no hay "tablas con esquema": las colecciones y campos nacen al
// escribir el primer documento. Este script crea un documento de ejemplo en
// cada colección/subcolección, con los IDs enlazados para mostrar las relaciones.
//
// Ejecutar:  node scripts/seed-firestore.mjs
// (Requiere reglas de Firestore que permitan escribir.)

import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, serverTimestamp } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDqZlibXLfB9mmKFCxn7drDqm21Gm9k-ZA",
  authDomain: "proyecto-rifas-e912b.firebaseapp.com",
  projectId: "proyecto-rifas-e912b",
  storageBucket: "proyecto-rifas-e912b.firebasestorage.app",
  messagingSenderId: "754803091254",
  appId: "1:754803091254:web:f81273dd62ef3a55eab597",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// IDs fijos para que las relaciones queden enlazadas y el script sea repetible.
const ADMIN_UID = "admin_demo";
const COMPRADOR_UID = "comprador_demo";
const RIFA_ID = "rifa_demo";
const NUMERO_ID = "042";
const PREMIO_ID = "premio_demo";
const VENTA_ID = "venta_demo";
const NOTIF_ID = "notif_demo";

async function seed() {
  // 1. usuarios (el ID del doc = UID de Firebase Auth)
  await setDoc(doc(db, "usuarios", ADMIN_UID), {
    nombre: "Administrador Demo",
    email: "admin@rifas.com",
    telefono: "+506 0000 0000",
    rol: "admin",
    creado_en: serverTimestamp(),
  });
  await setDoc(doc(db, "usuarios", COMPRADOR_UID), {
    nombre: "Comprador Demo",
    email: "comprador@rifas.com",
    telefono: "+506 1111 1111",
    rol: "comprador",
    creado_en: serverTimestamp(),
  });
  console.log("✅ usuarios");

  // 2. rifas
  await setDoc(doc(db, "rifas", RIFA_ID), {
    titulo: "Rifa de ejemplo",
    descripcion: "Premio de demostración",
    imagen_premio: "",
    precio_numero: 1000,
    total_numeros: 100,
    modo_juego: "clasica",
    estado: "activa",
    fecha_sorteo: null,
    numero_ganador: null,
    admin_id: ADMIN_UID,
    creado_en: serverTimestamp(),
  });
  console.log("✅ rifas");

  // 3. rifas/{id}/numeros (subcolección)
  await setDoc(doc(db, "rifas", RIFA_ID, "numeros", NUMERO_ID), {
    numero: 42,
    estado: "pagado",
    comprador_id: COMPRADOR_UID,
    reservado_en: serverTimestamp(),
  });
  console.log("✅ rifas/numeros");

  // 4. rifas/{id}/premios (subcolección)
  await setDoc(doc(db, "rifas", RIFA_ID, "premios", PREMIO_ID), {
    descripcion: "Primer premio",
    imagen_url: "",
    numero_ganador: null,
    posicion: 1,
  });
  console.log("✅ rifas/premios");

  // 5. ventas (datos denormalizados: numero y nombre_comprador copiados)
  await setDoc(doc(db, "ventas", VENTA_ID), {
    rifa_id: RIFA_ID,
    numero: 42,
    comprador_id: COMPRADOR_UID,
    nombre_comprador: "Comprador Demo",
    monto: 1000,
    estado_pago: "confirmado",
    comprobante_url: "",
    confirmado_por: ADMIN_UID,
    creado_en: serverTimestamp(),
  });
  console.log("✅ ventas");

  // 6. notificaciones
  await setDoc(doc(db, "notificaciones", NOTIF_ID), {
    usuario_id: COMPRADOR_UID,
    tipo: "compra",
    mensaje: "Tu número 42 fue confirmado.",
    leida: false,
    creado_en: serverTimestamp(),
  });
  console.log("✅ notificaciones");

  console.log("\n🎉 Estructura creada en Firestore.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Error al sembrar:", err.code, err.message);
  process.exit(1);
});
