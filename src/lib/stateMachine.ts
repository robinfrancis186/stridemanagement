import { type StateKey } from "./constants";

// Valid transitions: from -> to[]
export const VALID_TRANSITIONS: Record<string, string[]> = {
  S1: ["S2"],
  S2: ["S3"],
  S3: ["S4"],
  S4: ["H-INT-1", "H-DES-1"], // Path assignment determines which
  "H-INT-1": ["H-INT-2"],
  "H-INT-2": ["H-DOE-1"],
  "H-DES-1": ["H-DES-2"],
  "H-DES-2": ["H-DES-3"],
  "H-DES-3": ["H-DES-4"],
  "H-DES-4": ["H-DES-5"],
  "H-DES-5": ["H-DES-6"],
  "H-DES-6": ["H-DOE-1"],
  "H-DOE-1": ["H-DOE-2"],
  "H-DOE-2": ["H-DOE-3"],
  "H-DOE-3": ["H-DOE-4"],
  "H-DOE-4": ["H-DOE-5", "H-INT-1", "H-DES-1"], // APPROVE or REVISION
  "H-DOE-5": [], // Terminal state
};

// Gate criteria per state transition
export interface GateCriterion {
  id: string;
  label: string;
  required: boolean;
}

export const GATE_CRITERIA: Record<string, GateCriterion[]> = {
  "S1->S2": [
    { id: "title_complete", label: "Device title is clearly defined", required: true },
    { id: "source_identified", label: "Source type identified", required: true },
    { id: "description_present", label: "Description provided", required: true },
  ],
  "S2->S3": [
    { id: "gaps_reviewed", label: "Gap flags reviewed and updated", required: true },
    { id: "disability_classified", label: "Disability types classified", required: true },
    { id: "therapy_mapped", label: "Therapy domains mapped", required: true },
  ],
  "S3->S4": [
    { id: "priority_set", label: "Priority level assigned (P1/P2/P3)", required: true },
    { id: "tech_assessed", label: "Tech level assessed", required: true },
    { id: "pricing_estimated", label: "Market/target pricing estimated", required: false },
  ],
  "S4->H-INT-1": [
    { id: "path_internal", label: "Path assigned: STRIDE Internal", required: true },
    { id: "designer_available", label: "Internal designer availability confirmed", required: true },
  ],
  "S4->H-DES-1": [
    { id: "path_designathon", label: "Path assigned: Designathon", required: true },
    { id: "challenge_brief", label: "Challenge brief prepared", required: true },
  ],
  "H-INT-1->H-INT-2": [
    { id: "design_complete", label: "Design files completed", required: true },
    { id: "material_selected", label: "Materials selected", required: true },
  ],
  "H-INT-2->H-DOE-1": [
    { id: "prototype_tested", label: "Prototype functionally tested", required: true },
    { id: "ready_for_doe", label: "Ready for Design of Experiments", required: true },
  ],
  "H-DES-1->H-DES-2": [
    { id: "challenge_published", label: "Challenge published to teams", required: true },
  ],
  "H-DES-2->H-DES-3": [
    { id: "teams_registered", label: "At least one team registered", required: true },
  ],
  "H-DES-3->H-DES-4": [
    { id: "submissions_received", label: "Submissions received", required: true },
  ],
  "H-DES-4->H-DES-5": [
    { id: "judging_complete", label: "All judges scored submissions", required: true },
  ],
  "H-DES-5->H-DES-6": [
    { id: "winner_notified", label: "Winner notified", required: true },
    { id: "handover_docs", label: "Handover documentation prepared", required: true },
  ],
  "H-DES-6->H-DOE-1": [
    { id: "prototype_received", label: "Prototype received from winner", required: true },
  ],
  "H-DOE-1->H-DOE-2": [
    { id: "doe_protocol", label: "DoE protocol followed", required: true },
    { id: "data_collected", label: "Pre/post test data collected", required: true },
  ],
  "H-DOE-2->H-DOE-3": [
    { id: "doe_report", label: "DoE report compiled", required: true },
    { id: "results_analyzed", label: "Results statistically analyzed", required: true },
  ],
  "H-DOE-3->H-DOE-4": [
    { id: "committee_reviewed", label: "All committee members reviewed", required: true },
  ],
  "H-DOE-4->H-DOE-5": [
    { id: "committee_approved", label: "Committee decision: APPROVED", required: true },
  ],
  "H-DOE-4->H-INT-1": [
    { id: "revision_reason", label: "Revision reason documented (Internal path)", required: true },
  ],
  "H-DOE-4->H-DES-1": [
    { id: "revision_reason_des", label: "Revision reason documented (Designathon path)", required: true },
  ],
};

// Phase-specific fields for the feedback window
export interface PhaseField {
  id: string;
  label: string;
  type: "text" | "textarea" | "select";
  options?: string[];
  required: boolean;
}

export const PHASE_SPECIFIC_FIELDS: Record<string, PhaseField[]> = {
  "S1->S2": [
    { id: "reviewer_name", label: "Reviewer Name", type: "text", required: true },
    { id: "initial_assessment", label: "Initial Assessment Notes", type: "textarea", required: false },
  ],
  "S2->S3": [
    { id: "gap_corrections", label: "Gap Corrections Log", type: "textarea", required: true },
    { id: "validation_method", label: "Validation Method", type: "select", options: ["Field Visit", "Expert Review", "Literature", "Stakeholder Interview"], required: true },
  ],
  "S3->S4": [
    { id: "prioritization_rationale", label: "Prioritization Rationale", type: "textarea", required: true },
  ],
  "S4->H-INT-1": [
    { id: "assigned_designer", label: "Assigned Designer", type: "text", required: true },
    { id: "estimated_timeline", label: "Estimated Timeline (weeks)", type: "text", required: false },
  ],
  "S4->H-DES-1": [
    { id: "challenge_title", label: "Challenge Title", type: "text", required: true },
    { id: "target_audience", label: "Target Participant Audience", type: "text", required: false },
  ],
  "H-INT-1->H-INT-2": [
    { id: "material_used", label: "Primary Material Used", type: "text", required: true },
    { id: "manufacturing_method", label: "Manufacturing Method", type: "select", options: ["3D Printing", "CNC", "Injection Molding", "Hand Assembly", "Other"], required: true },
  ],
  "H-INT-2->H-DOE-1": [
    { id: "prototype_id", label: "Prototype ID / Version", type: "text", required: true },
  ],
  "H-DOE-1->H-DOE-2": [
    { id: "sample_size", label: "Sample Size", type: "text", required: true },
    { id: "testing_duration", label: "Testing Duration (days)", type: "text", required: true },
  ],
  "H-DOE-2->H-DOE-3": [
    { id: "key_findings", label: "Key Findings Summary", type: "textarea", required: true },
  ],
  "H-DOE-4->H-DOE-5": [
    { id: "production_notes", label: "Production Readiness Notes", type: "textarea", required: false },
  ],
  "H-DOE-4->H-INT-1": [
    { id: "revision_instructions", label: "Revision Instructions", type: "textarea", required: true },
  ],
  "H-DOE-4->H-DES-1": [
    { id: "revision_instructions", label: "Revision Instructions", type: "textarea", required: true },
  ],
};

export function getNextStates(currentState: string, pathAssignment: string | null): string[] {
  const nextStates = VALID_TRANSITIONS[currentState] || [];
  
  // At S4, filter by path assignment
  if (currentState === "S4" && pathAssignment) {
    if (pathAssignment === "INTERNAL") return ["H-INT-1"];
    if (pathAssignment === "DESIGNATHON") return ["H-DES-1"];
  }
  
  // At H-DOE-4, show all options (approve + revision paths)
  return nextStates;
}

export function getGateCriteria(fromState: string, toState: string): GateCriterion[] {
  return GATE_CRITERIA[`${fromState}->${toState}`] || [];
}

export function getPhaseFields(fromState: string, toState: string): PhaseField[] {
  return PHASE_SPECIFIC_FIELDS[`${fromState}->${toState}`] || [];
}

export function isTerminalState(state: string): boolean {
  return state === "H-DOE-5";
}

export function isPathAssignmentRequired(state: string): boolean {
  return state === "S4";
}
