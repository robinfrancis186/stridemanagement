

# STRIDE COE — Agentic AI Workflow Management System
## Three-Phase Implementation Plan

---

## Phase 1: Foundation — Auth, Data Layer & Core Dashboard
*Core infrastructure, authentication, requirement management, and pipeline view*

### Authentication & Access Control
- Login page with JWT-based auth via Supabase Auth
- Two roles: **COE Admin** (full access) and **Leadership Viewer** (read-only dashboard)
- Role-based route protection and navigation

### Database Schema (Supabase)
- **requirements** table — all fields from PRD Section 14.1 (UUID, title, source_type, priority, tech_level, disability_types, therapy_domains, market_price, stride_target_price, gap_flags, current_state, path_assignment, revision_number, etc.)
- **phase_feedbacks** table — stores all Phase Feedback Window data (from_state, to_state, phase_notes, attachments, blockers_resolved, key_decisions, phase_specific_data)
- **users** table — COE Admin and Leadership profiles
- **state_transitions** table — tracks every state change with timestamps
- RLS policies for role-based access

### COE Dashboard — Home (Pipeline View)
- Top navigation bar with STRIDE COE branding, logged-in user info, notification bell
- **Quick stat cards**: Total requirements, P1 active, production-ready this month, stuck items
- **Pipeline funnel visualization**: Horizontal bar chart showing counts at each state (S1 → S4 → H-INT/H-DES → H-DOE → Production-Ready)
- **Activity feed**: Last 20 state transitions and new ingestions
- **New ingestion queue**: Newly added requirements with RED/BLUE gap flags highlighted

### Requirement Detail View
- Header with device title, ID, source badge, priority badge, tech level badge, current state badge
- **Overview Tab**: All parsed fields with inline editing, data completeness progress bar, gap flags (RED/BLUE)
- **Timeline Tab**: Visual state progression showing each transition with date, user, and time-in-state
- Requirement listing page with filtering by state, priority, source type, and tech level
- Search functionality across requirements

### Manual Requirement Entry
- Form to manually add new requirements (since AI PDF parsing requires external service)
- Source type selection (CDC, SEN, BLIND, ELDERLY, BUDS, OTHER)
- All fields from the schema with validation
- Auto-set state to S1 (Captured) on creation

---

## Phase 2: Workflow Engine, Feedback System & File Uploads
*Complete state machine, Phase Feedback Windows, path assignment, and notifications*

### State Machine Engine
- Complete finite state machine with all 15 states across SENSING and HARMONIZING phases:
  - **SENSING**: S1 (Captured) → S2 (Under Review) → S3 (Validated) → S4 (Prioritized)
  - **HARMONIZING — Internal**: H-INT-1 (Design Started) → H-INT-2 (Prototype Ready)
  - **HARMONIZING — Designathon**: H-DES-1 through H-DES-6 (Challenge → Prototype Handed Over)
  - **Convergence**: H-DOE-1 (DoE In Progress) → H-DOE-2 (DoE Complete) → H-DOE-3 (Committee Review) → H-DOE-4 (Committee Decision) → H-DOE-5 (Production-Ready)
- Gate criteria validation at each transition (configurable checklists)
- Revision loop: REVISION NEEDED sends back to Design Started or Challenge Published
- State advancement button with gate criteria checks

### Phase Feedback Window (Modal)
- Modal overlay triggered on every "Advance to Next State" action
- **Universal fields**: Transition By (auto), Timestamp (auto), Phase Notes (rich text, 5000 chars), Attachments (file upload), Blockers Resolved, Key Decisions (tagged), Time in Phase (auto-calculated), Next Phase Readiness (checklist)
- **Phase-specific fields** that change based on current state (e.g., gap corrections log for S2, designer name for H-INT-1, material used for H-INT-2)
- Cannot advance without completing all required fields and gate criteria checklist

### Path Assignment
- At S4 (Prioritized), COE Admin assigns development path: **STRIDE Internal** or **Designathon/Hackathon**
- UI shows path selection with justification field
- Requirement routes to appropriate sub-workflow after assignment

### Feedback History Tab
- Chronological list of all Phase Feedback Window submissions per requirement
- Expandable cards showing full feedback details, attachments, and decisions

### File Upload System
- Supabase Storage integration for file uploads (PDF, images, STL, STEP files)
- Drag-and-drop upload zones in feedback windows and requirement detail
- File preview and download capabilities

### Version History
- **Versions Tab** on requirement detail: tracks all edits with who changed what, when
- Diff view between versions

### Notification System
- In-app notification bell with dropdown
- Notifications for: new requirements added, aging warnings, state transitions, committee decisions
- Notification preferences per user

### Designathon Management Screen
- Active events list with associated requirements
- Sub-state tracker: visual progress through H-DES-1 → H-DES-6
- Team registration tracking and submission management
- Basic judging score entry interface

---

## Phase 3: DoE, Committee Review, Dashboards & Reports
*Design of Experiments, committee workflows, Leadership dashboard, and documentation generation*

### DoE Data Capture Interface
- **DoE Tab** on requirement detail view
- Pre-test measurement data entry form (testing protocol, sample size, baseline data, beneficiary profiles)
- Post-test measurement data entry form (results, improvement metrics, beneficiary feedback)
- Side-by-side comparison charts (pre vs. post) using Recharts
- Statistical summary display

### DoE Database Tables
- **doe_records** table — pre_test_data, post_test_data, testing_protocol, sample_size, results_summary, statistical_analysis

### Committee Review Interface
- **Committee Review Screen**: split layout
  - Left panel: Complete device summary (requirement origin, design journey, DoE results, all phase feedback)
  - Right panel: Scoring form with sliders for each criterion (User Need 25%, Technical Feasibility 20%, DoE Results 25%, Cost Effectiveness 15%, Safety 15%)
- Free-text feedback field per committee member
- Mandatory recommendation: APPROVE / REVISE / REJECT
- Conditions field for conditional approvals
- **Decision Panel** (Committee Chair view): See all member reviews, enter consolidated decision, revision instructions

### Committee Database Tables
- **committee_reviews** table — individual member scores and feedback
- **committee_decisions** table — consolidated decision, revision instructions, decided_by

### Leadership Dashboard (Read-Only)
- **Pipeline Health**: Stacked bar chart showing flow through SENSING → HARMONIZING → Production-Ready
- **Source Distribution**: Donut chart (CDC, SEN, BLIND, ELDERLY, BUDS, OTHER)
- **Priority Breakdown**: P1 vs P2 vs P3 per phase
- **Tech Level Mix**: LOW vs MEDIUM vs HIGH distribution
- **Therapy Domain Radar Chart**: Coverage across OT, PT, Speech, ADL, Sensory, Cognitive
- **Aging Heatmap**: Requirements by state × time-in-state (green/yellow/red color coding)
- **Monthly Throughput**: Line chart — requirements entering vs reaching production-ready
- **30/60/90 Cycle Analytics**: Average days per phase with histogram
- **Cost Impact Dashboard**: Market price vs STRIDE price comparison with cumulative savings

### Production-Ready Catalogue
- Table of all approved devices with summary cards
- Download links for Device Documentation Packages
- Filterable by source, tech level, therapy domain

### Device Documentation Package
- Auto-generated document view compiling all data from requirement lifecycle:
  - Cover page, executive summary, requirement origin, target user profile
  - Technical specification, design journey timeline
  - Phase-by-phase feedback record, DoE report, committee review record
  - Version history, market comparison, manufacturing readiness
- Downloadable as structured view (PDF generation would need external service)

### Monthly Report View
- Dashboard showing monthly summary of production-ready devices
- Pipeline status, aging alerts, source distribution, cost impact
- Archival view of past monthly reports

### Aging Alert System
- Configurable thresholds: SENSING (7-day warning, 14-day critical), HARMONIZING Internal (30/60 days), Designathon (45/90 days), DoE (21/45 days)
- Visual indicators on dashboard and requirement cards
- Alert list view with root cause tracking

