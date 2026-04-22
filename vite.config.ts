import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: "/",
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "firebase/app": path.resolve(__dirname, "./src/shims/firebase/app.ts"),
      "firebase/auth": path.resolve(__dirname, "./src/shims/firebase/auth.ts"),
      "firebase/firestore": path.resolve(__dirname, "./src/shims/firebase/firestore.ts"),
      "firebase/storage": path.resolve(__dirname, "./src/shims/firebase/storage.ts"),
      "firebase/functions": path.resolve(__dirname, "./src/shims/firebase/functions.ts"),
    },
  },
}));
