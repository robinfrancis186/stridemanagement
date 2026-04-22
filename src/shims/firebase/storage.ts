import { mutateStore, readStore } from "./internal";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";

interface StorageReference {
  fullPath: string;
  name: string;
}

const splitStoragePath = (fullPath: string) => {
  const [bucket, ...parts] = fullPath.split("/");
  return { bucket, path: parts.join("/") };
};

const LOCAL_BLOB_DB = "stride-local-files";
const LOCAL_BLOB_STORE = "files";

let blobDbPromise: Promise<IDBDatabase> | null = null;

const openBlobDb = () => {
  if (!blobDbPromise) {
    blobDbPromise = new Promise((resolve, reject) => {
      const request = window.indexedDB.open(LOCAL_BLOB_DB, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(LOCAL_BLOB_STORE)) {
          db.createObjectStore(LOCAL_BLOB_STORE);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Failed to open local file store"));
    });
  }
  return blobDbPromise;
};

const runBlobTxn = async <T,>(mode: IDBTransactionMode, runner: (store: IDBObjectStore, resolve: (value: T) => void, reject: (reason?: unknown) => void) => void) => {
  const db = await openBlobDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(LOCAL_BLOB_STORE, mode);
    const store = tx.objectStore(LOCAL_BLOB_STORE);
    tx.onerror = () => reject(tx.error ?? new Error("Local file transaction failed"));
    runner(store, resolve, reject);
  });
};

const putLocalBlob = async (key: string, file: Blob) => {
  await runBlobTxn<void>("readwrite", (store, resolve, reject) => {
    const request = store.put(file, key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("Failed to save local file"));
  });
};

const getLocalBlob = async (key: string) =>
  runBlobTxn<Blob | null>("readonly", (store, resolve, reject) => {
    const request = store.get(key);
    request.onsuccess = () => resolve((request.result as Blob | undefined) ?? null);
    request.onerror = () => reject(request.error ?? new Error("Failed to load local file"));
  });

const deleteLocalBlob = async (key: string) => {
  await runBlobTxn<void>("readwrite", (store, resolve, reject) => {
    const request = store.delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("Failed to delete local file"));
  });
};

export const getStorage = (_app?: unknown) => ({ kind: "dual-storage" as const });

export const ref = (_storage: unknown, fullPath: string): StorageReference => ({
  fullPath,
  name: fullPath.split("/").pop() ?? fullPath,
});

export const uploadBytes = async (reference: StorageReference, file: File | Blob) => {
  if (hasSupabaseConfig && supabase) {
    const { bucket, path } = splitStoragePath(reference.fullPath);
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      upsert: true,
      contentType: "type" in file ? file.type : undefined,
    });
    if (error) throw error;
    return { ref: reference };
  }

  await putLocalBlob(reference.fullPath, file);
  mutateStore((store) => {
    store.storage[reference.fullPath] = {
      name: reference.name,
      type: "type" in file ? file.type : "",
      size: "size" in file ? file.size : 0,
    };
  });
  return { ref: reference };
};

export const getDownloadURL = async (reference: StorageReference) => {
  if (hasSupabaseConfig && supabase) {
    const { bucket, path } = splitStoragePath(reference.fullPath);
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
    if (error) throw error;
    return data.signedUrl;
  }

  const store = readStore();
  const entry = store.storage[reference.fullPath];
  if (!entry) {
    throw new Error("File not found");
  }

  const blob = await getLocalBlob(reference.fullPath);
  if (!blob) {
    mutateStore((draft) => {
      delete draft.storage[reference.fullPath];
    });
    throw new Error("File not found");
  }
  return URL.createObjectURL(blob);
};

export const deleteObject = async (reference: StorageReference) => {
  if (hasSupabaseConfig && supabase) {
    const { bucket, path } = splitStoragePath(reference.fullPath);
    const { error } = await supabase.storage.from(bucket).remove([path]);
    if (error) throw error;
    return;
  }

  await deleteLocalBlob(reference.fullPath);
  mutateStore((store) => {
    delete store.storage[reference.fullPath];
  });
};
