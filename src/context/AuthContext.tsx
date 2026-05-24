import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  signOut, 
  User as FirebaseUser,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile
} from 'firebase/auth';
import { doc, getDoc, setDoc, query, collection, where, getDocs, deleteDoc } from 'firebase/firestore';
import { auth, googleProvider, db } from '../lib/firebase';

export type UserRole = 
  | 'MEMBER' 
  | 'PRESIDENTA' 
  | 'VICE_PRESIDENTA' 
  | 'TESORERA' 
  | 'SECRETARIA' 
  | 'DIRECTOR_1' 
  | 'DIRECTOR_2' 
  | 'DIRECTOR_3';

interface AuthContextType {
  user: FirebaseUser | null;
  role: UserRole | null;
  loading: boolean;
  isBoard: boolean;
  login: () => Promise<void>;
  loginEmail: (email: string, pass: string) => Promise<void>;
  registerEmail: (email: string, pass: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const message = error instanceof Error ? error.message : String(error);
  const errInfo: FirestoreErrorInfo = {
    error: message,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  }
  
  if (message.includes('offline')) {
    console.warn('Firestore is offline, waiting for connection...', errInfo);
    return null; // Return null instead of throwing for offline errors to allow app to load
  }
  
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  // Only throw if it's not a transient connection error
  if (!message.includes('unavailable') && !message.includes('deadline-exceeded')) {
     throw new Error(JSON.stringify(errInfo));
  }
  return null;
}

function normalizeUserRole(userData: any): UserRole {
  let rawRole = userData.role || userData.rol || '';
  
  // If no direct role/rol but is defined in category/categoria
  if (!rawRole && userData.categoria) {
    const catLower = userData.categoria.toLowerCase().trim();
    if (['director', 'directora', 'director_1', 'director_2', 'director_3', 'presidenta', 'vice_presidenta', 'tesorera', 'secretaria', 'secretario', 'tesorero'].includes(catLower)) {
      rawRole = catLower;
    }
  }
  if (!rawRole && userData.category) {
    const catLower = userData.category.toLowerCase().trim();
    if (['director', 'directora', 'director_1', 'director_2', 'director_3', 'presidenta', 'vice_presidenta', 'tesorera', 'secretaria', 'secretario', 'tesorero'].includes(catLower)) {
      rawRole = catLower;
    }
  }

  if (!rawRole) return 'MEMBER';

  const upper = rawRole.toUpperCase().trim().replace(/[-]/g, '_');
  if (upper.includes('PRESIDEN')) return 'PRESIDENTA';
  if (upper.includes('VICE')) return 'VICE_PRESIDENTA';
  if (upper.includes('TESORER')) return 'TESORERA';
  if (upper.includes('SECRETAR')) return 'SECRETARIA';
  if (upper.includes('DIRECTOR_1') || upper === 'DIRECTOR 1') return 'DIRECTOR_1';
  if (upper.includes('DIRECTOR_2') || upper === 'DIRECTOR 2') return 'DIRECTOR_2';
  if (upper.includes('DIRECTOR_3') || upper === 'DIRECTOR 3') return 'DIRECTOR_3';
  if (upper.includes('DIRECTOR') || upper.includes('DIRECTORA')) return 'DIRECTOR_1';

  return 'MEMBER';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        setUser(firebaseUser);
        if (firebaseUser) {
          const emailToQuery = firebaseUser.email?.toLowerCase().trim() || '';
          const userDocRef = doc(db, 'socios', firebaseUser.uid);
          
          // Detect Gmail normalization to make search robust
          const isGmail = emailToQuery.endsWith('@gmail.com');
          const emailBase = emailToQuery.split('@')[0];
          const normalizedEmail = isGmail ? emailBase.replace(/\./g, '') + '@gmail.com' : emailToQuery;
          
          // Search in both 'email' and 'correo' fields to detect any duplicates or pre-registered docs
          const qEmail = query(collection(db, 'socios'), where('email', 'in', [emailToQuery, normalizedEmail]));
          const qCorreo = query(collection(db, 'socios'), where('correo', 'in', [emailToQuery, normalizedEmail]));
          
          const [snapEmail, snapCorreo] = await Promise.all([
            getDocs(qEmail),
            getDocs(qCorreo)
          ]);

          const allMatchingDocs = [...snapEmail.docs, ...snapCorreo.docs];
          const uniqueMatchingDocs = allMatchingDocs.filter((docItem, index, self) =>
            self.findIndex(d => d.id === docItem.id) === index
          );

          // Find if there is an existing document under actual firebase uid
          const existingUidDoc = uniqueMatchingDocs.find(d => d.id === firebaseUser.uid);
          
          // Find duplicate/placeholder docs under separate custom IDs
          const otherMatchingDocs = uniqueMatchingDocs.filter(d => d.id !== firebaseUser.uid);

          let mergedData: any = {};
          if (existingUidDoc) {
            mergedData = { ...existingUidDoc.data() };
          }

          // Merge any details/roles from duplicate files
          if (otherMatchingDocs.length > 0) {
            for (const otherDoc of otherMatchingDocs) {
              const dData = otherDoc.data();
              mergedData.name = mergedData.name || dData.name || dData.nombre || '';
              mergedData.nombre = mergedData.nombre || dData.nombre || dData.name || '';
              mergedData.rut = mergedData.rut || dData.rut || dData.RUT || '';
              mergedData.RUT = mergedData.RUT || dData.RUT || dData.rut || '';
              mergedData.phone = mergedData.phone || dData.phone || dData.telefono || '';
              mergedData.telefono = mergedData.telefono || dData.telefono || dData.phone || '';
              mergedData.business = mergedData.business || dData.business || dData.emprendimiento || '';
              mergedData.emprendimiento = mergedData.emprendimiento || dData.emprendimiento || dData.business || '';
              mergedData.category = mergedData.category || dData.category || dData.categoria || 'COMERCIO';
              mergedData.categoria = mergedData.categoria || dData.categoria || dData.category || 'COMERCIO';
              mergedData.status = mergedData.status || dData.status || dData.estado || 'ACTIVO';
              mergedData.estado = mergedData.estado || dData.estado || dData.status || 'ACTIVO';
              mergedData.debt = mergedData.debt !== undefined ? mergedData.debt : (dData.debt !== undefined ? dData.debt : 0);
              mergedData.attendance = mergedData.attendance !== undefined ? mergedData.attendance : (dData.attendance !== undefined ? dData.attendance : 0);
              
              const currentRole = normalizeUserRole(mergedData);
              const docRole = normalizeUserRole(dData);
              if (currentRole === 'MEMBER' && docRole !== 'MEMBER') {
                mergedData.role = docRole;
                mergedData.rol = docRole;
              }
            }
          }

          // Ensure basic parameters
          mergedData.email = (mergedData.email || emailToQuery).toLowerCase().trim();
          mergedData.correo = (mergedData.correo || emailToQuery).toLowerCase().trim();
          mergedData.uid = firebaseUser.uid;

          // SPECIAL OWNER BYPASS: If email is the president, enforce PRESIDENTA credentials absolutely
          if (emailToQuery === 'solucionesgraficasplanb@gmail.com') {
            mergedData.role = 'PRESIDENTA';
            mergedData.rol = 'PRESIDENTA';
            if (!mergedData.name || mergedData.name === 'Socio' || mergedData.name === 'Presidenta') {
              mergedData.name = 'ANGELICA CAROLINA BUSTOS PEÑA';
              mergedData.nombre = 'ANGELICA CAROLINA BUSTOS PEÑA';
            }
            if (!mergedData.rut || mergedData.rut === 'Pte.' || !mergedData.rut) {
              mergedData.rut = '15.110.132-1';
              mergedData.RUT = '15.110.132-1';
            }
            if (!mergedData.business) {
              mergedData.business = 'PUBLICIDAD PLAN B SOLUCIONES GRAFICAS';
              mergedData.emprendimiento = 'PUBLICIDAD PLAN B SOLUCIONES GRAFICAS';
            }
          }

          const finalRole = normalizeUserRole(mergedData);
          mergedData.role = finalRole;
          mergedData.rol = finalRole;

          const isAuthorized = uniqueMatchingDocs.length > 0 || emailToQuery === 'solucionesgraficasplanb@gmail.com';

          if (isAuthorized) {
            // Write finalized merged data to UID path
            await setDoc(userDocRef, {
              ...mergedData,
              updatedAt: new Date().toISOString()
            }, { merge: true });

            // Clean up and delete ALL duplicate documents under placeholder IDs
            for (const docToDelete of otherMatchingDocs) {
              await deleteDoc(doc(db, 'socios', docToDelete.id));
            }

            setRole(finalRole);
          } else {
            // Not registered in system
            alert(`ACCESO DENEGADO: Su correo (${emailToQuery}) no figura en la base de datos oficial.

Por favor, contacte a la directiva para verificar que su correo fue ingresado exactamente igual al que está usando ahora.`);
            await signOut(auth);
            setUser(null);
            setRole(null);
          }
        } else {
          setRole(null);
        }
      } catch (error) {
        console.error("Auth error:", error);
        setRole(null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const login = useCallback(async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed", error);
      alert("Error al intentar iniciar sesión con Google. Por favor, intente nuevamente.");
    }
  }, []);

  const loginEmail = useCallback(async (email: string, pass: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (error) {
      console.error("Email login failed", error);
      throw error;
    }
  }, []);

  const registerEmail = useCallback(async (email: string, pass: string, name: string) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      await updateProfile(userCredential.user, { displayName: name });
    } catch (error) {
      console.error("Registration failed", error);
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed", error);
    }
  }, []);

  const isBoard = role !== null && role !== 'MEMBER';

  const value = useMemo(() => ({
    user,
    role,
    loading,
    isBoard,
    login,
    loginEmail,
    registerEmail,
    logout
  }), [user, role, loading, isBoard, login, loginEmail, registerEmail, logout]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
