# Implementation work plan

Source: [functional specification v1.1](../INTERNET_SAFETY_COMPANION_FUNCTIONAL_SPEC_FINAL.md). Status: planning only; all implementation tasks below are unclaimed and not started. This document assigns responsibility by role without inventing teammate commitments. Replace the owner cell with a person's name when they claim a task.

## Three roles

| Role | Main ownership | First task after the shared kickoff |
| --- | --- | --- |
| A — Backend and permissions | Sessions, k-ID mapping, authorization, ownership, persistence, cancellation enforcement | W02 provider access/session spike |
| B — Extension and experience | Site access, extraction/rules, warnings, companion screens and accessibility | W03 P01/P16 extension slice |
| C — AI and voice | Gemini reasoning, Inworld output, Modulate redaction, provider failure paths | W06 contract review and provider-access inventory |

Claim work by editing the task's owner/status in a small PR, or linking an agreed issue in its evidence cell. Allowed task states: **unclaimed**, **ready**, **in progress**, **blocked**, **in review**, **done**. A blocked task records the exact missing input and next action; mocks do not erase live-integration blockers. Choose one integration coordinator from the team at kickoff. That person coordinates merges and the demo, without owning every task.

## Kickoff and sequence

1. Agree on the roles and coordinator. Read CONTRIBUTING and spec sections 4, 6, 8.1, 10, and 15–17.
2. Complete W00 and W01 together before independent code branches diverge. Approve one workspace, shared schemas, P01/P16 expected outputs, and provider mode labels.
3. Start the real k-ID access/session spike early. Build P01/P16 locally while live access is being resolved. Never invent vendor interfaces to hide an access blocker.
4. Integrate extension → owned assessment → evidence/safe action → optional preset challenge. Keep this slice runnable as providers are added.
5. Add Gemini text → Inworld output → Modulate input in that order. Demonstrate server denial and Stop/revocation before expanding the happy path.
6. Complete replay-safe learning, P08, and the remaining catalog. Reserve the final hour before the event's confirmed submission deadline for integration, regression, documentation and rehearsal. Event times in the spec require confirmation before operational use.

## Delivery gates

| Gate | Required result | Exit evidence |
| --- | --- | --- |
| M0 — Shared foundation | W00/W01 merged; W02 live access investigation underway | Clean-clone bootstrap, schema validation, agreed fixtures and sanitized access/blocker record |
| M1 — Useful local flow | P01/P16 through the actual unpacked extension and companion | Parsed hostname, observed request, evidence, safe action, no false high-concern warning on P16; permitted preset path works without voice |
| M2 — Enforced capabilities | Supported k-ID test flow and denied/unknown/revoked behavior | Real sandbox decisions and provenance where access exists; direct backend denial tests; exact blocker if access is missing |
| M3 — Voice teaching moment | One adult-presenter Modulate → Gemini → Inworld turn | Captions match validated reply, only redacted text reaches reasoning, Stop/revocation discards late work; per-stage live/mock evidence |
| M4 — Learning and full coverage | One-credit/replay flow, P08, P01–P18 and full acceptance catalog | Deterministic rubric/award tests, scenario outcomes and browser/provider verification records |
| M5 — Reviewable demonstration | Two-minute rehearsal and reproducible handoff | Real extension smoke result, provider-status table, exact run instructions and remaining limitations |

An unmet gate remains incomplete. If time expires, report the working slice and list unmet requirements; do not relabel full iteration 1 as complete.

## Claimable tasks

Every task starts **unclaimed**; the role below is the proposed owner. Dependencies name integration prerequisites, not a prohibition on independent design or access checks. Use `feat/<task-name>`, `fix/<task-name>`, or `chore/<task-name>` branches under CONTRIBUTING.

| ID | Deliverable | Proposed owner | Depends on | Status | Evidence / PR |
| --- | --- | --- | --- | --- | --- |
| W00 | Workspace and reproducible developer setup | A + B + C | — | unclaimed | — |
| W01 | Shared contracts and P01/P16 baseline fixtures | A + B + C | W00 | unclaimed | — |
| W02 | Authentication, k-ID sessions and capability enforcement | A | W01 | unclaimed | — |
| W03 | MV3 site access, extraction, local rules and popup | B | W01 | unclaimed | — |
| W04 | Companion onboarding, finding view and demo navigation | B | W01; W02 for live flow | unclaimed | — |
| W05 | Extension-to-companion assessment flow and warnings | A + B | W02–W04 | unclaimed | — |
| W06 | Gemini evidence-based typed coaching | C | W01/W02/W05 | unclaimed | — |
| W07 | Inworld speech output and captions | C + B | W06 | unclaimed | — |
| W08 | Modulate push-to-talk and cancellable voice turns | C + A + B | W02/W07 | unclaimed | — |
| W09 | Curated challenges, progress and badges | A + B | W01/W04; W02 for owned accounts | unclaimed | — |
| W10 | Privacy controls, deletion, revocation and lifecycle cleanup | A + B + C | W02/W05; W08 for voice cleanup | unclaimed | — |
| W11 | Full scenario catalog and all-ages copy | B + C | W01/W05 | unclaimed | — |
| W12 | Automated regression and actual extension smoke validation | A + B + C | W03–W11 as each lands | unclaimed | — |
| W13 | Runbook, honest provider report and two-minute rehearsal | Coordinator + A + B + C | W12; record all unmet gates | unclaimed | — |

### W00 — Bootstrap

- Establish the TypeScript workspace described in the architecture proposal, one lockfile, shared runtime choices and clear package ownership. Inspect local starter files before adopting any; do not accidentally publish unrelated work.
- Add commands for install, development, extension build, production build, tests and demo reset. Keep secrets server-side and add needed variable names without values.
- Done when a fresh clone can execute documented commands, load the unpacked extension shell, reach app/backend, and run the repository guard. Replace the README's pending-setup text with verified commands.

### W01 — Contracts and baseline fixtures

- Implement runtime schemas for contexts, capability snapshots, assessments, messages, provider modes/errors, attempts and voice turns; agree on the backend-owned fields.
- Define P01 and its P16 legitimate comparison, stable evidence IDs, parsed-hostname behavior, pre-authored explanations and one curated challenge. Include expected concern/no-concern outputs.
- Done when all three components consume the same validated examples, malformed/oversized inputs are rejected, production/demo modes cannot be confused, and the rubric is not exposed as a client authority.

### W02 — Permissions and provider access

- Inventory actual event/vendor access and document the supported k-ID test-session path. Confirm permission keys, jurisdiction handling, correction/consent workflow, expiry and callback rules from the configured documentation before coding live calls.
- Implement authenticated owned sessions, normalized capability decisions and protected-operation guards. Client-edited age/country or simulated grants cannot authorize production operations.
- Done when denied/unknown/pending/expired requests are rejected directly at the backend, test sessions show provenance, correction/revocation refreshes decisions, and production/demo separation is tested. Missing live access remains a named blocker; deterministic mocks are labeled.

### W03 — Extension and local detection

- Implement MV3 popup/worker/content scripts, optional origin grants, `activeTab` manual checks, enable/pause controls and restart-safe state. Sensitive sites are manual by default.
- Exclude hidden/editable/password/payment fields and injected UI. Add bounded/debounced local rules for credential/OTP requests, fake-check forwarding, unusual payment demands and combined pressure/secrecy signals. Use a maintained domain parser; brand-like substrings alone cannot establish ownership or fraud.
- Done when the real extension detects P01 and P08, leaves P16's legitimate/educational variants free of keyword-only high-concern warnings, and handles missing access, unsupported languages, navigation and dynamic content accurately.

### W04 — Companion experience

- Build onboarding and capability states, finding evidence/safe action, coach shell, practice, badges, settings and demo navigation. Represent children, teens, adults and older-adult preferences from the outset.
- Keep site/browser grants, application permissions and user opt-ins visible and distinct. No production permission switch hidden behind a demo control.
- Done when keyboard-only users can reach each section, context correction/limited states explain next steps, large-text/plain-language preferences work, and preset/text participation remains available where permitted.

### W05 — First integrated slice

- Connect local assessments to owned backend references and companion views. Navigation URLs contain no sensitive excerpts. Validate extension messages, request schemas, ownership and configured origins.
- Add concise dismissible warnings, evidence expansion, safe next action and mistaken-warning feedback. Deduplicate cards/cues; cap unsolicited cards per spec and avoid stale context after navigation/restart.
- Done when P01/P16 run end-to-end through the actual extension, supported manual checks handle empty/oversized/inaccessible input, cloud consent absence prevents outbound analysis, and a warning never submits a form or follows a suspicious link.

### W06 — Gemini text

- Confirm configured SDK/auth/retention and implement the documented adapter behind permission and cloud-consent guards. Separate trusted task instructions from untrusted page evidence and user text.
- Validate structured replies and known evidence IDs; provider output cannot grant permissions, grade mastery or invoke arbitrary actions. Preserve pre-authored explanations with accurate offline labeling.
- Done when allowed text works, direct denied calls never dispatch, fabricated/foreign evidence IDs are rejected, injection cannot override authority, and timeouts/provider failures preserve a labeled text/preset path. Record live verification separately from mocks.

### W07 — Inworld output

- Speak only validated owned explanation text after checking applicable output grants and spoken-coaching opt-in. Show the same text as captions with Play, Stop, replay and mute; handle autoplay denial visibly.
- Keep the visible companion session as the first playback surface. Output never requests microphone access or starts recording.
- Done when opt-out remains silent, denied/revoked output cannot play, captions match, and Inworld failure preserves the explanation and accurate status.

### W08 — Modulate and full voice lifecycle

- Add explicit push-to-talk in the companion, browser permission handling, recording indicator and 15-second/2-MiB limits. Validate upload MIME type/size/duration and turn ownership.
- Use Modulate's documented redaction response with proper multipart parsing; only redacted text may reach Gemini. Revalidate permission at each provider stage and before delayed delivery.
- Implement one turn at a time, cancellation/context versions, deadlines, track/URL cleanup and explicit restart after restoration. Confirm interpreted spoken choices before rubric submission.
- Done when a permitted recording completes the full chain, redaction failure prevents raw fallback, Stop/navigation/revocation discard late replies, cross-session access fails, browser denial preserves permitted alternatives, and no raw recording/transcript enters durable storage or logs.

### W09 — Learning and awards

- Implement versioned curated rubrics and stable `credit_key` values, independent/revealed attempt state, server grading, per-owner uniqueness and transactional/idempotent awards. Live flags earn feedback only.
- Implement every badge/status threshold exactly as spec section 10, including categories and the insufficient-evidence requirement. Equivalent objectives cannot become farmable by changing versions.
- Done when correct independent attempts earn one credit, reveal/retry/replay/concurrent requests cannot duplicate it, client/model correctness is ignored, legitimate/ambiguous judgments can earn credit, and all ages can progress without voice or adult material.

### W10 — Privacy and revocation

- Keep history off by default; opt-in local incident entries expire after seven days. Progress is separate. Implement owned delete/reset, consent changes and no-memory behavior.
- Remove raw content/voice/DOB from persistence and logs. Document provider retention before live use and disable cloud processing if its retention obligations cannot be met.
- Done when deletion cannot affect another owner, revocation stops dependent work while allowed local protection survives, logs/network/storage are inspected, and external contact/guardian actions remain informational only.

### W11 — Complete fixture catalog

- Cover all P01–P18 families with deterministic expected outcomes and an expected no-risk or ambiguous variant for each. Keep source/mode labels and reserved synthetic domains clear.
- Include P04 privacy coercion, P08 fake-check detection, P09 unverified-image appeal, P14 sourced claim card, P15 provenance uncertainty, P17 accessibility and P18 context/connection/revocation transitions.
- Serious-harm examples stay scripted, supportive and non-graphic. Do not invent hotlines, citations, image authenticity or live verification. Only verified source metadata may be presented as real; invented metadata is fixture data.
- Done when fixture coverage lists all 18 IDs and variants, the demo center exposes them, no external actions occur, and age/jurisdiction differences reflect test provenance rather than stereotypes or invented legal rules.

### W12 — Regression and integration evidence

- Add meaningful unit tests for rules/capabilities/rubrics, backend integration tests for ownership/idempotency/provider failures, and browser tests for the companion and actual unpacked extension where supported.
- Mandatory browser scenarios: child P01, teen P04, adult P08/P09 and legitimate P16. Exercise site access, pause/restart, dynamic content, alert deduplication, sensitive-field exclusion, accessibility and stale voice turns.
- Done when every acceptance ID below links to a test or recorded manual result, failures remain visible, and automated extension limitations are accompanied by an actual manual-extension checklist/result. App-only tests cannot count as extension validation. Live provider tests remain separate from mocked tests.

### W13 — Final handoff and rehearsal

- Update README with exact verified setup/Chrome loading steps, provider configuration names, demo reset, supported workflows and limitations. Record provider status, environment/mode, test date, sanitized evidence and outstanding blockers.
- Rehearse spec section 16: P01 warning → preset participation → teen adaptation → adult voice turn → second-country test-session difference → revocation/text fallback and learning result.
- Done when the runbook is reproducible, the two-minute flow is timed, factual claims match evidence, event requirements/track are confirmed, and remaining incomplete requirements are disclosed. Pre-recorded/scripted audio remains labeled. No deployment or extension publication is included.

## Acceptance coverage

The exact criteria remain in spec section 15. Each row below covers every ID in its range; owners must replace planned coverage with evidence. Mapping an ID here is not a passing test.

| Criteria | Primary tasks | Evidence required |
| --- | --- | --- |
| F01–F02 | W02/W04 | All-ages onboarding, production/demo isolation and tampering tests |
| F03–F05 | W03/W05 | Fake-check detection, manual input states and negative fixtures |
| F06–F08 | W02/W04/W08/W10 | Direct denial, mic denial, fallback and two-profile behavior |
| F09 | W11 | Sourced fixture versus unverified claim/image labeling |
| F10–F11 | W03/W05/W10 | Extraction exclusions, disabled sites, lifecycle and deduplication |
| F12–F13 | W01/W05/W11/W12 | All 18 families and variants, required actual-browser cases, P01/P16 hostname evidence |
| F14–F15 | W02/W06–W08/W13 | Actual test-session provenance and provider-specific verification records |
| V01–V02 | W02/W07/W08 | Output opt-in, explicit input, browser access and direct API denial |
| V03–V04 | W06–W08 | Multipart/redaction parsing, known evidence and matching captions |
| V05–V06 | W07/W08/W10 | Stop/revocation/stale results and independent provider-failure paths |
| V07 | W08/W09 | Confirmed interpreted choices and unchanged mastery rules |
| V08–V10 | W03/W05/W08/W10/W12 | Retention/log inspection, no repeated cues, payload/ownership/context rejection, keyboard/text completion |
| G01–G06 | W09/W11 | No credit for flags, independent credit, replay/concurrency, thresholds, legitimate cases and nonmonetary rewards |
| S01–S02 | W02/W05–W08/W10 | Network, persistence and logging inspection under denied consent/memory |
| S03–S04 | W02/W06/W09/W10 | Owned deletion, injection resistance and authority boundaries |
| S05–S06 | W04/W05/W11/W12 | No external actions; keyboard and screen-reader flows |

## PR and handoff checklist

- State task IDs and the before/after behavior; keep shared-contract changes explicit and reviewed by consumers.
- Link the fixture and exact acceptance IDs exercised. Record the commands/manual steps actually run and outcomes, without checking unrun tests as passed.
- Record each provider's true mode and any unresolved live contract/access/retention issue. Never attach raw recordings, sensitive excerpts or credentials as evidence.
- Run the repository guard, obtain one teammate approval and green `guard` CI, then squash merge under CONTRIBUTING. The repo owner controls any permitted override.
- Update task owner/status/evidence and README when supported setup or behavior changes. Leave unfinished acceptance criteria open.
