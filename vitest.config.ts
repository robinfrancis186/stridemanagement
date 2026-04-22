import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/._*"],
  },
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
});
