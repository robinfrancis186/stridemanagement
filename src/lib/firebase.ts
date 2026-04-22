import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";
import { hasSupabaseConfig } from "./supabase";

// These imports resolve to adapter modules. When Supabase env vars are present,
// the adapters talk to Supabase; otherwise they fall back to the local backend.
const app = initializeApp({
    provider: hasSupabaseConfig ? "supabase" : "local",
});

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, "supabase");
