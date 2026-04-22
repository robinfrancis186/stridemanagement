type Primitive = string | number | boolean | null;

type JsonValue = Primitive | JsonValue[] | { [key: string]: JsonValue };

interface LocalUserRecord {
  uid: string;
  email: string;
  password: string;
  displayName: string;
}

interface LocalStore {
  version: number;
  users: Record<string, LocalUserRecord>;
  sessionUserId: string | null;
  collections: Record<string, Record<string, Record<string, JsonValue>>>;
  storage: Record<string, { name: string; type: string; size: number }>;
  passwordResets: Record<string, string>;
}

export const DEMO_USER_ID = "demo-admin-user";
const STORAGE_KEY = "stride-local-backend-v1";
const STORE_VERSION = 1;

type AuthListener = (user: LocalUserRecord | null) => void;

const authListeners = new Set<AuthListener>();

const clone = <T,>(value: T): T => {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
};

const isoDaysAgo = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
};

const seededStore = (): LocalStore => {
  const demoUser: LocalUserRecord = {
    uid: DEMO_USER_ID,
    email: "admin@stride.local",
    password: "stride-demo",
    displayName: "STRIDE Admin",
  };

  const req1 = "req-adaptive-spoon";
  const req2 = "req-braille-tiles";
  const req3 = "req-walker-grip";
  const req4 = "req-feeding-cup";

  return {
    version: STORE_VERSION,
    users: {
      [demoUser.uid]: demoUser,
    },
    sessionUserId: demoUser.uid,
    collections: {
      profiles: {
        [demoUser.uid]: {
          email: demoUser.email,
          full_name: demoUser.displayName,
        },
      },
      user_roles: {
        [demoUser.uid]: {
          user_id: demoUser.uid,
          role: "coe_admin",
        },
      },
      requirements: {
        [req1]: {
          title: "Adaptive Eating Spoon",
          description: "Lightweight spoon with rotating handle support for children with low grip stability.",
          source_type: "CDC",
          priority: "P1",
          tech_level: "MEDIUM",
          disability_types: ["Physical"],
          therapy_domains: ["OT", "ADL"],
          market_price: 240,
          stride_target_price: 110,
          gap_flags: ["RED"],
          current_state: "S3",
          path_assignment: null,
          revision_number: 0,
          created_by: demoUser.uid,
          created_at: isoDaysAgo(18),
          updated_at: isoDaysAgo(5),
        },
        [req2]: {
          title: "Braille Learning Tiles",
          description: "Modular tactile tiles for early braille familiarization in inclusive classrooms.",
          source_type: "BLIND",
          priority: "P2",
          tech_level: "LOW",
          disability_types: ["Visual"],
          therapy_domains: ["Cognitive", "ADL"],
          market_price: 180,
          stride_target_price: 90,
          gap_flags: ["BLUE"],
          current_state: "H-DES-3",
          path_assignment: "DESIGNATHON",
          revision_number: 0,
          created_by: demoUser.uid,
          created_at: isoDaysAgo(45),
          updated_at: isoDaysAgo(9),
        },
        [req3]: {
          title: "Pediatric Walker Grip",
          description: "Ergonomic grip attachment to reduce wrist strain during long therapy sessions.",
          source_type: "SEN",
          priority: "P1",
          tech_level: "HIGH",
          disability_types: ["Physical", "Multiple"],
          therapy_domains: ["PT"],
          market_price: 520,
          stride_target_price: 250,
          gap_flags: ["RED"],
          current_state: "H-DOE-2",
          path_assignment: "INTERNAL",
          revision_number: 1,
          created_by: demoUser.uid,
          created_at: isoDaysAgo(102),
          updated_at: isoDaysAgo(12),
        },
        [req4]: {
          title: "Spill-Control Feeding Cup",
          description: "Cup lid and angled handle system for elders with tremor-related drinking difficulty.",
          source_type: "ELDERLY",
          priority: "P3",
          tech_level: "LOW",
          disability_types: ["Physical"],
          therapy_domains: ["ADL"],
          market_price: 150,
          stride_target_price: 80,
          gap_flags: [],
          current_state: "H-DOE-5",
          path_assignment: "INTERNAL",
          revision_number: 0,
          created_by: demoUser.uid,
          created_at: isoDaysAgo(160),
          updated_at: isoDaysAgo(2),
        },
      },
      state_transitions: {
        "tr-1": {
          requirement_id: req1,
          from_state: "NEW",
          to_state: "S1",
          transitioned_by: demoUser.uid,
          notes: "Imported from community screening visit.",
          created_at: isoDaysAgo(18),
        },
        "tr-2": {
          requirement_id: req1,
          from_state: "S1",
          to_state: "S2",
          transitioned_by: demoUser.uid,
          notes: "Validated source and caregiver notes.",
          created_at: isoDaysAgo(14),
        },
        "tr-3": {
          requirement_id: req1,
          from_state: "S2",
          to_state: "S3",
          transitioned_by: demoUser.uid,
          notes: "Therapy and disability mappings reviewed.",
          created_at: isoDaysAgo(5),
        },
        "tr-4": {
          requirement_id: req2,
          from_state: "S4",
          to_state: "H-DES-1",
          transitioned_by: demoUser.uid,
          notes: "Published to designathon track.",
          created_at: isoDaysAgo(30),
        },
        "tr-5": {
          requirement_id: req2,
          from_state: "H-DES-1",
          to_state: "H-DES-2",
          transitioned_by: demoUser.uid,
          notes: "Registrations opened.",
          created_at: isoDaysAgo(22),
        },
        "tr-6": {
          requirement_id: req2,
          from_state: "H-DES-2",
          to_state: "H-DES-3",
          transitioned_by: demoUser.uid,
          notes: "Submissions received from four teams.",
          created_at: isoDaysAgo(9),
        },
        "tr-7": {
          requirement_id: req3,
          from_state: "H-INT-2",
          to_state: "H-DOE-1",
          transitioned_by: demoUser.uid,
          notes: "Prototype approved for trials.",
          created_at: isoDaysAgo(33),
        },
        "tr-8": {
          requirement_id: req3,
          from_state: "H-DOE-1",
          to_state: "H-DOE-2",
          transitioned_by: demoUser.uid,
          notes: "Pilot test completed.",
          created_at: isoDaysAgo(12),
        },
        "tr-9": {
          requirement_id: req4,
          from_state: "H-DOE-4",
          to_state: "H-DOE-5",
          transitioned_by: demoUser.uid,
          notes: "Cleared for production batch.",
          created_at: isoDaysAgo(2),
        },
      },
      phase_feedbacks: {
        "pf-1": {
          requirement_id: req1,
          from_state: "S2",
          to_state: "S3",
          phase_notes: "Confirmed grip instability patterns with occupational therapists.",
          blockers_resolved: ["Need for adjustable handle"],
          key_decisions: ["Keep head size standard for replaceable utensils"],
          phase_specific_data: { validation_method: "Stakeholder Interview" },
          submitted_by: demoUser.uid,
          created_at: isoDaysAgo(5),
        },
      },
      doe_records: {
        "doe-1": {
          requirement_id: req3,
          testing_protocol: "Observe 12 guided therapy sessions across two clinics.",
          sample_size: 12,
          baseline_data: { metrics: [{ metric_name: "Grip fatigue", unit: "self-report" }] },
          beneficiary_profiles: ["Children aged 6-10 using walkers"],
          pre_test_data: { measures: ["Grip strain survey"] },
          post_test_data: { measures: ["Grip strain survey", "Therapist observation"] },
          improvement_metrics: [{ metric: "Reported discomfort", target_improvement: "30%" }],
          statistical_analysis: { methods: ["paired t-test"], estimated_duration_weeks: 4 },
          results_summary: "Early results show reduced fatigue and better handle control.",
          created_at: isoDaysAgo(12),
          updated_at: isoDaysAgo(10),
        },
      },
      committee_reviews: {
        "cr-1": {
          requirement_id: req4,
          reviewer_name: "Clinical Lead",
          usability_score: 4,
          safety_score: 5,
          manufacturability_score: 4,
          cost_score: 4,
          weighted_total: 4.3,
          recommendation: "APPROVE",
          notes: "Suitable for immediate pilot manufacturing.",
          created_at: isoDaysAgo(3),
        },
      },
      committee_decisions: {
        "cd-1": {
          requirement_id: req4,
          decision: "APPROVED",
          conditions: "Run packaging QA before shipment.",
          created_at: isoDaysAgo(2),
        },
      },
      notifications: {
        "nt-1": {
          user_id: demoUser.uid,
          title: "Committee approval complete",
          message: "Spill-Control Feeding Cup reached production-ready state.",
          type: "state_transition",
          read: false,
          requirement_id: req4,
          created_at: isoDaysAgo(2),
        },
      },
      designathon_events: {
        "de-1": {
          title: "Braille Tile Sprint",
          requirement_id: req2,
          description: "Rapid concept sprint for classroom tactile learning aids.",
          created_at: isoDaysAgo(30),
          updated_at: isoDaysAgo(9),
        },
      },
      designathon_teams: {
        "dt-1": {
          event_id: "de-1",
          team_name: "Tactile Forge",
          members: ["Asha", "Rahul", "Mina"],
          submission_link: "Prototype submitted",
          score: 88,
          is_winner: true,
          created_at: isoDaysAgo(11),
        },
      },
      requirement_versions: {},
      requirement_files: {},
    },
    storage: {},
    passwordResets: {},
  };
};

const loadStore = (): LocalStore => {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const store = seededStore();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    return store;
  }

  try {
    const parsed = JSON.parse(raw) as LocalStore;
    const sanitizedStorage = Object.fromEntries(
      Object.entries(parsed.storage ?? {}).map(([path, entry]) => [
        path,
        {
          name: String((entry as { name?: string }).name ?? path.split("/").pop() ?? path),
          type: String((entry as { type?: string }).type ?? ""),
          size: Number((entry as { size?: number }).size ?? 0),
        },
      ]),
    );
    const sanitized = {
      ...parsed,
      storage: sanitizedStorage,
    } satisfies LocalStore;
    if (parsed.version !== STORE_VERSION) {
      const store = seededStore();
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
      return store;
    }
    if (JSON.stringify(parsed.storage ?? {}) !== JSON.stringify(sanitizedStorage)) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
    }
    return sanitized;
  } catch {
    const store = seededStore();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    return store;
  }
};

let storeCache: LocalStore | null = null;

export const getStore = (): LocalStore => {
  if (!storeCache) {
    storeCache = loadStore();
  }
  return storeCache;
};

export const saveStore = (nextStore: LocalStore) => {
  storeCache = nextStore;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextStore));
  } catch (error) {
    if (error instanceof DOMException && (error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED")) {
      const trimmedStore = {
        ...nextStore,
        storage: {},
      };
      storeCache = trimmedStore;
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmedStore));
      return;
    }
    throw error;
  }
};

export const readStore = () => clone(getStore());

export const mutateStore = <T,>(mutator: (draft: LocalStore) => T): T => {
  const draft = readStore();
  const result = mutator(draft);
  saveStore(draft);
  return result;
};

export const getCurrentUserRecord = () => {
  const store = getStore();
  const uid = store.sessionUserId;
  return uid ? store.users[uid] ?? null : null;
};

export const subscribeAuth = (listener: AuthListener) => {
  authListeners.add(listener);
  return () => authListeners.delete(listener);
};

export const notifyAuthListeners = () => {
  const user = getCurrentUserRecord();
  authListeners.forEach((listener) => listener(user ? clone(user) : null));
};

export const generateId = (prefix = "id") => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
};

export const ensureCollection = (name: string) =>
  mutateStore((store) => {
    if (!store.collections[name]) {
      store.collections[name] = {};
    }
    return store.collections[name];
  });

export const resetLocalBackend = () => {
  const store = seededStore();
  saveStore(store);
  notifyAuthListeners();
};
