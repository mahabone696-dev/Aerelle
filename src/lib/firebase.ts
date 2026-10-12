import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import { connectFirestoreEmulator, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore'

// Web app settings for the Aerelle Firebase project. These identify the project and are safe to publish;
// access to data is controlled by firestore.rules, not by keeping these secret.
const config = {
  apiKey: 'AIzaSyDLoWvdDHbEfqL35dmpWwLivVrHcvBoylw',
  authDomain: 'aerelle-studio-696.firebaseapp.com',
  projectId: 'aerelle-studio-696',
  storageBucket: 'aerelle-studio-696.firebasestorage.app',
  messagingSenderId: '636600859909',
  appId: '1:636600859909:web:e817f048dac590062e0b6c',
}

export const app = initializeApp(config)
export const auth = getAuth(app)

const EMULATOR = import.meta.env.VITE_EMULATOR === '1'

function makeDb() {
  if (EMULATOR) return initializeFirestore(app, { ignoreUndefinedProperties: true })
  try {
    // Offline cache: pages open instantly from the last copy, and writes show up before the server confirms.
    return initializeFirestore(app, { ignoreUndefinedProperties: true, localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) })
  } catch {
    // Private browsing or blocked storage: run without the offline cache.
    return initializeFirestore(app, { ignoreUndefinedProperties: true })
  }
}
export const db = makeDb()

// Local end-to-end testing against the Firebase emulators (VITE_EMULATOR=1).
if (EMULATOR) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8085)
}
