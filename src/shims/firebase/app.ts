export interface FirebaseApp {
  name: string;
  options: Record<string, unknown>;
}

export const initializeApp = (options: Record<string, unknown> = {}): FirebaseApp => ({
  name: "local-app",
  options,
});
