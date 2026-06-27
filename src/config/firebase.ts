import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyDJ8u3n_IkI_Tb5jG5bxoP-bbtjmudje7M",
  authDomain: "msg-app-1923e.firebaseapp.com",
  projectId: "msg-app-1923e",
  storageBucket: "msg-app-1923e.firebasestorage.app",
  messagingSenderId: "570570521421",
  appId: "1:570570521421:web:6eb2d226f239efcf21d504",
  measurementId: "G-QX6R2QW8FC"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
