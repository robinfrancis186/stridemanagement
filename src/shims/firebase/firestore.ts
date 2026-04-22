import { cloneDeep } from "./utils";
import { ensureCollection, generateId, mutateStore, readStore } from "./internal";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";

type Operator = "==" | ">=" | "<=" | ">" | "<";
type Direction = "asc" | "desc";

interface CollectionReference {
  kind: "collection";
  name: string;
}

interface DocumentReference {
  kind: "document";
  collection: string;
  id: string;
}

interface QueryConstraint {
  kind: "where" | "orderBy" | "limit";
  field?: string;
  operator?: Operator;
  value?: unknown;
  direction?: Direction;
  count?: number;
}

interface QueryReference {
  kind: "query";
  collection: string;
  constraints: QueryConstraint[];
}

class DocumentSnapshot {
  id: string;
  private payload: Record<string, unknown> | null;

  constructor(id: string, payload: Record<string, unknown> | null) {
    this.id = id;
    this.payload = payload ? cloneDeep(payload) : null;
  }

  exists() {
    return this.payload !== null;
  }

  data() {
    return this.payload ? cloneDeep(this.payload) : undefined;
  }
}

class QueryDocumentSnapshot extends DocumentSnapshot {
  data() {
    return super.data() ?? {};
  }
}

class QuerySnapshot {
  docs: QueryDocumentSnapshot[];

  constructor(docs: QueryDocumentSnapshot[]) {
    this.docs = docs;
  }

  get empty() {
    return this.docs.length === 0;
  }
}

const createSnapshot = (rows: Array<{ id: string; [key: string]: unknown }>) =>
  new QuerySnapshot(
    rows.map(({ id, ...data }) => new QueryDocumentSnapshot(id, data as Record<string, unknown>)),
  );

export const getFirestore = (_app?: unknown) => ({ kind: "dual-firestore" as const });

export const collection = (_db: unknown, name: string): CollectionReference => {
  ensureCollection(name);
  return { kind: "collection", name };
};

export const doc = (parent: unknown, maybeCollection: string, maybeId?: string): DocumentReference => {
  if ((parent as CollectionReference)?.kind === "collection") {
    return {
      kind: "document",
      collection: (parent as CollectionReference).name,
      id: maybeCollection,
    };
  }

  return {
    kind: "document",
    collection: maybeCollection,
    id: maybeId!,
  };
};

export const query = (source: CollectionReference | QueryReference, ...constraints: QueryConstraint[]): QueryReference => ({
  kind: "query",
  collection: source.kind === "collection" ? source.name : source.collection,
  constraints: [...(source.kind === "query" ? source.constraints : []), ...constraints],
});

export const where = (field: string, operator: Operator, value: unknown): QueryConstraint => ({
  kind: "where",
  field,
  operator,
  value,
});

export const orderBy = (field: string, direction: Direction = "asc"): QueryConstraint => ({
  kind: "orderBy",
  field,
  direction,
});

export const limit = (count: number): QueryConstraint => ({
  kind: "limit",
  count,
});

const compare = (left: unknown, operator: Operator, right: unknown) => {
  if (operator === "==") return left === right;
  if (operator === ">=") return left >= right;
  if (operator === "<=") return left <= right;
  if (operator === ">") return left > right;
  return left < right;
};

const applyLocalQuery = (collectionName: string, constraints: QueryConstraint[]) => {
  const store = readStore();
  const records = Object.entries(store.collections[collectionName] ?? {}).map(([id, data]) => ({ id, data }));

  const filtered = records.filter(({ data }) =>
    constraints
      .filter((constraint) => constraint.kind === "where")
      .every((constraint) =>
        compare((data as Record<string, unknown>)[constraint.field!], constraint.operator!, constraint.value),
      ),
  );

  const orderConstraints = constraints.filter((constraint) => constraint.kind === "orderBy");
  if (orderConstraints.length > 0) {
    filtered.sort((left, right) => {
      for (const constraint of orderConstraints) {
        const leftValue = left.data[constraint.field!];
        const rightValue = right.data[constraint.field!];
        if (leftValue === rightValue) continue;
        const comparison = leftValue! > rightValue! ? 1 : -1;
        return constraint.direction === "desc" ? -comparison : comparison;
      }
      return 0;
    });
  }

  const limitConstraint = constraints.find((constraint) => constraint.kind === "limit");
  return typeof limitConstraint?.count === "number" ? filtered.slice(0, limitConstraint.count) : filtered;
};

const requireSupabase = () => {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }
  return supabase;
};

const buildSupabaseQuery = (collectionName: string, constraints: QueryConstraint[]) => {
  let builder: any = requireSupabase().from(collectionName).select("*");

  for (const constraint of constraints) {
    if (constraint.kind === "where") {
      if (constraint.operator === "==") builder = builder.eq(constraint.field, constraint.value);
      if (constraint.operator === ">=") builder = builder.gte(constraint.field, constraint.value);
      if (constraint.operator === "<=") builder = builder.lte(constraint.field, constraint.value);
      if (constraint.operator === ">") builder = builder.gt(constraint.field, constraint.value);
      if (constraint.operator === "<") builder = builder.lt(constraint.field, constraint.value);
    }
    if (constraint.kind === "orderBy") {
      builder = builder.order(constraint.field, { ascending: constraint.direction !== "desc" });
    }
    if (constraint.kind === "limit" && typeof constraint.count === "number") {
      builder = builder.limit(constraint.count);
    }
  }

  return builder;
};

export const getDoc = async (reference: DocumentReference) => {
  if (hasSupabaseConfig && supabase) {
    const { data, error } = await requireSupabase()
      .from(reference.collection)
      .select("*")
      .eq("id", reference.id)
      .maybeSingle();
    if (error) throw error;
    return new DocumentSnapshot(reference.id, (data as Record<string, unknown> | null) ?? null);
  }

  const store = readStore();
  const payload = store.collections[reference.collection]?.[reference.id] ?? null;
  return new DocumentSnapshot(reference.id, payload as Record<string, unknown> | null);
};

export const getDocs = async (source: CollectionReference | QueryReference) => {
  const collectionName = source.kind === "collection" ? source.name : source.collection;
  const constraints = source.kind === "query" ? source.constraints : [];

  if (hasSupabaseConfig && supabase) {
    const { data, error } = await buildSupabaseQuery(collectionName, constraints);
    if (error) throw error;
    return createSnapshot((data ?? []) as Array<{ id: string; [key: string]: unknown }>);
  }

  const rows = applyLocalQuery(collectionName, constraints);
  return new QuerySnapshot(rows.map(({ id, data }) => new QueryDocumentSnapshot(id, data as Record<string, unknown>)));
};

export const addDoc = async (reference: CollectionReference, data: Record<string, unknown>) => {
  if (hasSupabaseConfig && supabase) {
    const { data: inserted, error } = await requireSupabase()
      .from(reference.name)
      .insert(data)
      .select("id")
      .single();
    if (error) throw error;
    return { id: String(inserted.id), path: `${reference.name}/${inserted.id}` };
  }

  const id = generateId(reference.name);
  mutateStore((store) => {
    if (!store.collections[reference.name]) {
      store.collections[reference.name] = {};
    }
    store.collections[reference.name][id] = cloneDeep(data);
  });
  return { id, path: `${reference.name}/${id}` };
};

export const setDoc = async (reference: DocumentReference, data: Record<string, unknown>) => {
  if (hasSupabaseConfig && supabase) {
    const { error } = await requireSupabase()
      .from(reference.collection)
      .upsert({ id: reference.id, ...data }, { onConflict: "id" });
    if (error) throw error;
    return;
  }

  mutateStore((store) => {
    if (!store.collections[reference.collection]) {
      store.collections[reference.collection] = {};
    }
    store.collections[reference.collection][reference.id] = cloneDeep(data);
  });
};

export const updateDoc = async (reference: DocumentReference, data: Record<string, unknown>) => {
  if (hasSupabaseConfig && supabase) {
    const { error } = await requireSupabase().from(reference.collection).update(data).eq("id", reference.id);
    if (error) throw error;
    return;
  }

  mutateStore((store) => {
    if (!store.collections[reference.collection]) {
      store.collections[reference.collection] = {};
    }
    const current = store.collections[reference.collection][reference.id] ?? {};
    store.collections[reference.collection][reference.id] = {
      ...current,
      ...cloneDeep(data),
    };
  });
};

export const deleteDoc = async (reference: DocumentReference) => {
  if (hasSupabaseConfig && supabase) {
    const { error } = await requireSupabase().from(reference.collection).delete().eq("id", reference.id);
    if (error) throw error;
    return;
  }

  mutateStore((store) => {
    delete store.collections[reference.collection]?.[reference.id];
  });
};

export { DocumentSnapshot, QuerySnapshot };
