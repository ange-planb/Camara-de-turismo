import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// The configuration will contain the correct database instance if needed
const firestoreSettings = {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
};

// Explicitly define and hook into the custom-named database to resolve mobile blank screens
const databaseId = "ai-studio-f076ed68-303d-4044-a1a0-57595795b877";
export const db = initializeFirestore(app, firestoreSettings, databaseId);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
