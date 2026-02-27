import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
    apiKey: "AIzaSyDsXKgWMu3WCwrlfNrIrX5BUuoxGRUWOxM",
    authDomain: "stride-management-system-new.firebaseapp.com",
    projectId: "stride-management-system-new",
    storageBucket: "stride-management-system-new.firebasestorage.app",
    messagingSenderId: "551697906567",
    appId: "1:551697906567:web:b531c72b1bcab42931f122"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, 'nam5');
