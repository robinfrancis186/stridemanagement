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

export const getStorage = (_app?: unknown) => ({ kind: "dual-storage" as const });

export const ref = (_storage: unknown, fullPath: string): StorageReference => ({
  fullPath,
  name: fullPath.split("/").pop() ?? fullPath,
});

const fileToDataUrl = (file: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsDataURL(file);
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

  const dataUrl = await fileToDataUrl(file);
  mutateStore((store) => {
    store.storage[reference.fullPath] = {
      name: reference.name,
      type: "type" in file ? file.type : "",
      size: "size" in file ? file.size : 0,
      dataUrl,
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
  return entry.dataUrl;
};

export const deleteObject = async (reference: StorageReference) => {
  if (hasSupabaseConfig && supabase) {
    const { bucket, path } = splitStoragePath(reference.fullPath);
    const { error } = await supabase.storage.from(bucket).remove([path]);
    if (error) throw error;
    return;
  }

  mutateStore((store) => {
    delete store.storage[reference.fullPath];
  });
};
