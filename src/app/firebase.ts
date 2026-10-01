import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyCDFFNPuz65e-YDC2v212zeOdST8WEEzyc',
  authDomain: 'physiomotionplusapp-admin.firebaseapp.com',
  projectId: 'physiomotionplusapp-admin',
  storageBucket: 'physiomotionplusapp-admin.firebasestorage.app',
  messagingSenderId: '206136730544',
  appId: '1:206136730544:web:f317208f390fc1c9ff2c75',
};

export const adminFirebaseApp = initializeApp(firebaseConfig);
export const adminAuth = getAuth(adminFirebaseApp);
