# Architecture and integration handoffs

Status: proposed implementation defaults, based on functional specification v1.1 sections 6–8 and 12–14. No component or endpoint in this document is implemented by the planning PR. The specification governs product behavior; [CONTRIBUTING.md](../CONTRIBUTING.md) governs contribution policy.

## Proposed workspace

Use the specification's TypeScript monorepo default unless the bootstrap review records a reason to change it. The repository has no committed application stack. A local untracked Next.js starter is not a reason to publish or adopt it without review.

```text
apps/
  companion/           React + Vite; onboarding, findings, coach, learning, settings
  extension/           Chrome MV3 + Vite; popup, content script, service worker
  api/                 Node.js; sessions, capabilities, provider adapters, progress
packages/
  contracts/           Runtime schemas and TypeScript types; no provider secrets
  detection/           Local pure rules, evidence extraction contracts, URL parsing
  fixtures/            Synthetic personas, P01–P18 cases, challenge definitions
docs/                  Architecture, work plan, later run/verification instructions
```

W00 owns package-manager/runtime choices, pinned dependencies, and one lockfile. SQLite is the default development progress store; runtime schemas use Zod or an equivalent. Package names, ports, exact paths, and framework versions become established only in the reviewed bootstrap PR. Avoid independently creating competing app roots or lockfiles.

### Required script outcomes

W00 must document and verify one command each for dependency installation, app/backend development, extension development/build, production build, unit/integration tests, browser smoke tests, and demo reset. A clean clone must reproduce them. These are outcomes to implement, not commands already available.

The README must then name the real extension build directory and explain Chrome Developer mode → Load unpacked, site permissions, local fixture URL, companion/API addresses, and the expected first warning. Include any actual host mapping needed for fixture domains; simulated fixture URL metadata must be explicitly labeled.

## Shared contracts before independent work

W01 owns schema changes with review from the consuming role. The following is an internal design outline, not vendor field names or a replacement for runtime validation.

| Contract | Required handoff |
| --- | --- |
| User context and session | Pseudonymous owner, minimum age context, jurisdiction source, mode (`demo`, provider sandbox/test, production), context version; no raw DOB by default |
| Capability snapshot | Per-capability decision, source/provenance, last validation, provider reference and documented expiry where supplied; distinguish browser grants and user opt-ins |
| Assessment/finding | Owned ID, category, severity, evidence IDs/excerpts, observation versus interpretation, source/version, uncertainty, safe actions, timestamp, intervention and assessment state |
| Provider status | `live verified`, `implemented but unverified`, `mock`, `not configured`, or `deferred`; attach mode/provenance and sanitized evidence separately |
| Challenge/attempt | Stable `credit_key`, challenge/version, category, server rubric, confirmed choice, reveal state, idempotency key; correctness is server-derived |
| Voice turn | Owned assessment/session reference, turn ID, context version, stage, cancellation/deadline state; raw media/transcripts are transient |
| Structured error | Stable application code, readable message, retryability and request ID; no raw provider payloads or secrets |

Use the capability names and five decision states from spec section 6. All applicable decisions must authorize an operation; unknown/pending/expired/denied values fail closed for that operation. A backend guard must run even if UI controls are hidden. k-ID permission keys and provider APIs must be mapped from the configured documentation; internal examples are not assumed vendor contracts.

## Component responsibilities

| Component | Owns | Boundary |
| --- | --- | --- |
| Content script | Visible permitted content, local extraction/rules, accessible warning | Exclude sensitive/editable fields and own UI; no cloud call without required consent and eligibility |
| Extension worker/popup | Validated messages, per-site access/preferences, current status, authenticated backend requests | Worker suspension is expected; persist necessary state in Chrome storage; a preference does not grant browser access |
| Companion | Evidence view, permissions display, learning UI, capture/playback and captions | Only explicit Talk starts recording; output opt-in does not authorize input; no provider credentials |
| Backend | Authentication, ownership, permission decisions, orchestration, progress and deletion | Enforce each protected operation and delayed delivery; no arbitrary URL fetching or provider proxy |
| Shared packages | Validated contracts, pure detection, synthetic data and deterministic rubrics | Browser imports must not pull server adapters, secrets, private logs, or answer-bearing server rubric data into clients |

Manual checks use temporary `activeTab` access. Automatic origin checks require user-granted optional host access plus content-script registration. Banking/webmail are manual by default unless explicitly enabled. Keep warnings useful independently of voice availability.

Extension-to-companion navigation passes a short-lived, session-owned assessment reference, never raw excerpts in a URL. Validate message sender, operation, schema, and size. Restrict CORS to configured origins and enforce authentication/ownership in addition to origin checks.

## Application API handoff

These logical routes come from spec section 14. They are application routes to implement, not asserted vendor endpoints. W01 establishes exact request/response/error schemas; W02 supplies ownership and capability enforcement before providers are called.

| Route | Owning task | Required behavior |
| --- | --- | --- |
| `POST /api/onboarding/session`, `POST /api/onboarding/context`, `GET /api/capabilities` | W02 | Supported context/session transitions, permission provenance, no client-granted production authorization |
| `POST /api/assessments`, `POST /api/findings/:id/feedback` | W05 | Bounded minimized text/link inputs; owned findings and respectful feedback |
| `POST /api/coaching/messages` | W06 | Capability/consent checks, known evidence only, validated response, labeled fallback |
| `POST /api/voice/speech` | W07 | Only permitted validated explanation text for an owned context; no arbitrary TTS proxy |
| `POST /api/voice/turns`, `POST /api/voice/turns/:turnId/cancel` | W08 | Bounded recording, ownership, redaction-first sequencing, stage checks and cancellation |
| `GET /api/challenges`, `POST /api/challenges/:id/attempts`, `GET /api/progress` | W09 | Public challenge payload without answer rubric, server grading and transactional unique awards |
| `DELETE /api/user-data` | W10 | Owned-data deletion, cancellation and local-state cleanup coordination |

## Provider and voice boundary

1. Revalidate session, owned assessment, every applicable grant, and user intent before recording submission.
2. Send a bounded recording to Modulate's documented redaction interface. Parse the real multipart response using a MIME parser; tagging alone is not redaction.
3. Send only its redacted transcript plus permitted minimal evidence to Gemini. Redaction failure stops the provider chain; never substitute raw input.
4. Validate structured Gemini output, including that every evidence ID belongs to the assessment. Display captions immediately.
5. Recheck voice output permission and turn/context currency before Inworld generation and delivery/playback. Stop or revocation invalidates late results.

Keep one active turn per session. Default limits from the spec: 15 seconds/2 MiB recording, 10 seconds per cloud call, configurable 20-second turn deadline after recording. Local scans use 10,000 characters/batch; cloud excerpts use at most 2,000 characters. Configure limits centrally and measure actual outcomes. Recording/audio/transcripts do not become durable app records.

Mock adapters implement the same contracts with explicit provenance and deterministic outcomes. They must never authorize production calls. For live adapters, record SDK/API version, documented permission mapping, supported formats, retention configuration, test date/mode, sanitized result and unresolved issues. Documentation review alone is not verification.

## Handoff rules

The backend role owns sessions, capabilities and persistence; the experience role owns extension and companion UI; the AI/voice role owns provider reasoning/audio adapters. Shared-schema changes require review from the consumer. Each PR includes the task ID, contract impact, fixture, reproduction steps, tests actually run, provider mode and remaining blockers.

Integrate against one agreed P01/P16 fixture pair before expanding the catalog. Use deterministic implementations at a documented boundary while waiting on another task, and preserve honest mode labels. A blocked live adapter does not block independent local detection, accessible UI, curated learning, or negative-case tests.
