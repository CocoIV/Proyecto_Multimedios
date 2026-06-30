// Proveedor de autenticación de la app.
// Centraliza el login con Google, el estado de la sesión y el alta del
// usuario en Firestore (colección `usuarios/{uid}` según el esquema).
//
// Uso:
//   const { user, perfil, loading, signInWithGoogle, signOut } = useAuth();

import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Platform } from 'react-native';

import { auth, db } from '@/config/firebase';

/** Perfil del usuario tal como vive en Firestore (usuarios/{uid}). */
export type PerfilUsuario = {
  nombre: string;
  email: string;
  telefono: string;
  rol: 'admin' | 'comprador';
  creado_en?: any;
};

type AuthContextValue = {
  user: User | null;
  perfil: PerfilUsuario | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Crea el documento del usuario en `usuarios/{uid}` la primera vez que
 * inicia sesión, o actualiza sus datos básicos si ya existía.
 * Nunca pisa el `rol` ni el `creado_en` de un usuario ya registrado.
 */
async function upsertPerfil(u: User): Promise<PerfilUsuario> {
  const ref = doc(db, 'usuarios', u.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    const nuevo: PerfilUsuario = {
      nombre: u.displayName ?? 'Sin nombre',
      email: u.email ?? '',
      telefono: u.phoneNumber ?? '',
      rol: 'comprador',
    };
    await setDoc(ref, { ...nuevo, creado_en: serverTimestamp() });
    return nuevo;
  }

  // Ya existía: refrescamos solo nombre/email, respetando rol y telefono.
  const data = snap.data() as Partial<PerfilUsuario> & { rol?: string; creado_en?: any };
  await setDoc(
    ref,
    { nombre: u.displayName ?? data.nombre ?? '', email: u.email ?? data.email ?? '' },
    { merge: true }
  );

  return {
    nombre: u.displayName ?? data.nombre ?? '',
    email: u.email ?? data.email ?? '',
    telefono: data.telefono ?? '',
    rol: (data.rol as PerfilUsuario['rol']) ?? 'comprador',
    creado_en: data.creado_en,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [perfil, setPerfil] = useState<PerfilUsuario | null>(null);
  const [loading, setLoading] = useState(true);

  // Escucha cambios de sesión (login / logout / recarga).
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          setPerfil(await upsertPerfil(u));
        } catch (e: any) {
          console.error('Error sincronizando perfil — código:', e?.code, 'mensaje:', e?.message, e);
          setPerfil(null);
        }
      } else {
        setPerfil(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  async function signInWithGoogle() {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    if (Platform.OS === 'web') {
      // Flujo de popup: funciona de inmediato con Google habilitado en Firebase.
      await signInWithPopup(auth, provider);
      return;
    }

    // En nativo (Expo Go / build) el popup de Firebase no está disponible.
    // Requiere expo-auth-session + Client IDs de Google. Mientras tanto,
    // avisamos con un mensaje claro en vez de fallar en silencio.
    throw new Error(
      'El inicio con Google en móvil requiere configurar expo-auth-session. ' +
        'Por ahora probá la app en la web (npx expo start --web).'
    );
  }

  async function signOut() {
    await fbSignOut(auth);
  }

  const value = useMemo(
    () => ({ user, perfil, loading, signInWithGoogle, signOut }),
    [user, perfil, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
