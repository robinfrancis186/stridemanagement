export const STATES = {
  S1: { label: "Captured", phase: "SENSING", color: "info" },
  S2: { label: "Under Review", phase: "SENSING", color: "info" },
  S3: { label: "Validated", phase: "SENSING", color: "info" },
  S4: { label: "Prioritized", phase: "SENSING", color: "info" },
  "H-INT-1": { label: "Design Started", phase: "HARMONIZING", color: "warning" },
  "H-INT-2": { label: "Prototype Ready", phase: "HARMONIZING", color: "warning" },
  "H-DES-1": { label: "Challenge Published", phase: "DESIGNATHON", color: "accent" },
  "H-DES-2": { label: "Teams Registered", phase: "DESIGNATHON", color: "accent" },
  "H-DES-3": { label: "Submissions In", phase: "DESIGNATHON", color: "accent" },
  "H-DES-4": { label: "Judging Complete", phase: "DESIGNATHON", color: "accent" },
  "H-DES-5": { label: "Winner Selected", phase: "DESIGNATHON", color: "accent" },
  "H-DES-6": { label: "Prototype Handed Over", phase: "DESIGNATHON", color: "accent" },
  "H-DOE-1": { label: "DoE In Progress", phase: "CONVERGENCE", color: "secondary" },
  "H-DOE-2": { label: "DoE Complete", phase: "CONVERGENCE", color: "secondary" },
  "H-DOE-3": { label: "Committee Review", phase: "CONVERGENCE", color: "secondary" },
  "H-DOE-4": { label: "Committee Decision", phase: "CONVERGENCE", color: "secondary" },
  "H-DOE-5": { label: "Production-Ready", phase: "CONVERGENCE", color: "success" },
} as const;

export type StateKey = keyof typeof STATES;

export const SOURCE_TYPES = ["CDC", "SEN", "BLIND", "ELDERLY", "BUDS", "OTHER"] as const;
export const PRIORITIES = ["P1", "P2", "P3"] as const;
export const TECH_LEVELS = ["LOW", "MEDIUM", "HIGH"] as const;
export const THERAPY_DOMAINS = ["OT", "PT", "Speech", "ADL", "Sensory", "Cognitive"] as const;
export const DISABILITY_TYPES = ["Physical", "Visual", "Hearing", "Cognitive", "Multiple"] as const;
