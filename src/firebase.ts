
import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyCX-KOUYunwA7hoqPQ3N3QNCcNBVpkK1-Q',
  authDomain: 'react-challenges-austin-c0167.firebaseapp.com',
  projectId: 'react-challenges-austin-c0167',
  storageBucket: 'react-challenges-austin-c0167.firebasestorage.app',
  messagingSenderId: '863074218459',
  appId: '1:863074218459:web:8531a4ceb208fdf1e237fe',
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);

const databaseURL = import.meta.env.VITE_FIREBASE_DATABASE_URL?.trim();

export const realtimeDb = databaseURL ? getDatabase(app, databaseURL) : null;
