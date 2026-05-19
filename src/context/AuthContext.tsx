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
          
          // 1. Check if doc with UID already exists
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const userDoc = await getDoc(userDocRef);

          if (userDoc.exists()) {
            // Already identified
            setRole(userDoc.data().role as UserRole);
          } else {
            // 2. New login, check if there's a pre-registered doc (from CSV or manual add)
            // Handle Gmail dots and aliases for robust matching
            const isGmail = emailToQuery.endsWith('@gmail.com');
            const emailBase = emailToQuery.split('@')[0];
            const normalizedEmail = isGmail ? emailBase.replace(/\./g, '') + '@gmail.com' : emailToQuery;
            
            // Search by exact email or normalized email
            const q = query(collection(db, 'users'), where('email', 'in', [emailToQuery, normalizedEmail]));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
              // Found a match - use the first one
              const preDoc = querySnapshot.docs[0];
              const rawData = preDoc.data();
              
              // Standardize to English fields while preserving Spanish ones for safety
              const standardizedData = {
                uid: firebaseUser.uid,
                name: rawData.name || rawData.nombre || firebaseUser.displayName || 'Socio',
                email: (rawData.email || rawData.correo || emailToQuery).toLowerCase().trim(),
                role: rawData.role || rawData.rol || 'MEMBER',
                status: rawData.status || rawData.estado || 'ACTIVO',
                rut: rawData.rut || rawData.RUT || 'Pte.',
                business: rawData.business || rawData.emprendimiento || '',
                phone: rawData.phone || rawData.telefono || '',
                category: rawData.category || rawData.categoria || 'COMERCIO',
                debt: rawData.debt || 0,
                attendance: rawData.attendance || 0,
                updatedAt: new Date().toISOString()
              };

              // Move data to the official UID doc
              await setDoc(userDocRef, standardizedData);

              // Delete OLD placeholder to prevent "vitiated" or double entries
              if (preDoc.id !== firebaseUser.uid) {
                await deleteDoc(doc(db, 'users', preDoc.id));
              }
              
              setRole(standardizedData.role as UserRole);
            } else if (emailToQuery === 'solucionesgraficasplanb@gmail.com') {
              // Auto-bootstrap for system owner
              const presidentRole: UserRole = 'PRESIDENTA';
              await setDoc(userDocRef, {
                uid: firebaseUser.uid,
                name: firebaseUser.displayName || 'Presidenta',
                email: emailToQuery,
                role: presidentRole,
                status: 'ACTIVO',
                debt: 0,
                attendance: 0,
                createdAt: new Date().toISOString()
              });
              setRole(presidentRole);
            } else {
              // Not found in DB
              alert(`ACCESO DENEGADO: Su correo (${emailToQuery}) no figura en la base de datos oficial.

Por favor, contacte a la directiva para verificar que su correo fue ingresado exactamente igual al que está usando ahora.`);
              await signOut(auth);
              setUser(null);
              setRole(null);
            }
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
