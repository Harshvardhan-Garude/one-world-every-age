# Architecture and integration handoffs

Product: Ozone Layer (working title; internal identifiers keep the earlier "Beacon" name, see the README's Naming section). Based on functional specification v1.2, including parent-approved purchases (section 13.1).

Status: W00/W01 (merged in PR #4) implements the workspace and baseline contracts described in [the foundation runbook](FOUNDATION.md). Remaining APIs and product behavior below are future handoff targets based on functional specification v1.2 sections 6–8 and 12–14, including 13.1. The specification governs product behavior; [CONTRIBUTING.md](../CONTRIBUTING.md) governs contribution policy.

The local integration now implements W02 and the P01/P16 offline companion teaching flow described in [BACKEND.md](BACKEND.md). Purchase routes below remain design targets. The optional browser k-ID widget is not an identity handoff: `/api/kid/claim` reports a redemption blocker, and `/api/kid/session` accepts only a W02 bearer plus context version. Never turn a widget session ID into application ownership. See [the integration decisions](INTEGRATION.md) for exact included commits and remaining shared work.

## Proposed workspace

W00/W01 (merged in PR #4) uses the specification's TypeScript monorepo default. The prior untracked Next.js starter was preserved outside the checkout. See the runbook for implemented paths, scripts and limits.

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

W00 selected npm workspaces, Node 22 LTS, pinned lockfile dependencies, and one root lockfile. SQLite is the default development progress store; runtime schemas use Zod or an equivalent. Actual package names, ports, paths and versions are recorded in the foundation runbook and root lockfile; they remain subject to bootstrap review. Avoid independently creating competing app roots or lockfiles.

### Required script outcomes

The README now documents verified commands for dependency installation, app/backend development, extension development/build, production build, tests, browser smoke and demo reset. W00/W01 verification is recorded in the foundation runbook; later functionality still needs its owning tests.

The README names the real extension build directory and explains Chrome Developer mode → Load unpacked, local fixtures and companion/API addresses. The current extension shows a manual-access notice; an actual threat warning remains W03/W05 work. Include any actual host mapping needed for fixture domains; simulated fixture URL metadata must be explicitly labeled.

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
| Purchase policy | Owning adult admin, child session reference, rule (`off`, `approve_each`, `monthly_limit`), monthly limit in minor units and currency, what happens over the limit (`ask_parent` or `deny`), notify-after-purchase flag, version |
| Purchase request | Server-generated ID (also sent to k-ID as its request ID), child session, item from our own catalog, server-priced amount and currency, state (`requested`, `awaiting_parent`, `approved`, `denied`, `expired`, `charging`, `charged`, `charge_failed`, `blocked_by_policy`), k-ID `expiresAt`, FastSpring references; no card data |

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
| `GET /api/purchase-policy`, `PUT /api/purchase-policy` | W14 | Adult admin only; changes apply to new requests and are rechecked right before any charge |
| `POST /api/payment-method/checkout` | W14 | Adult admin only; starts a FastSpring hosted checkout to save a card. Returns a checkout reference, never card data |
| `POST /api/purchases`, `GET /api/purchases`, `GET /api/purchases/:id` | W14 | Child requests an item from our catalog; the price comes from the server catalog, never the client |
| `POST /api/webhooks/kid` | W14 | Verifies k-ID's signature; handles `Transaction.PurchaseApprovalResult`; ignores repeats by request ID |
| `POST /api/webhooks/fastspring` | W14 | Verifies FastSpring's signature; handles order and charge results; ignores repeats by event ID |

## Provider and voice boundary

1. Revalidate session, owned assessment, every applicable grant, and user intent before recording submission.
2. Send a bounded recording to Modulate's documented redaction interface. Parse the real multipart response using a MIME parser; tagging alone is not redaction.
3. Send only its redacted transcript plus permitted minimal evidence to Gemini. Redaction failure stops the provider chain; never substitute raw input.
4. Validate structured Gemini output, including that every evidence ID belongs to the assessment. Display captions immediately.
5. Recheck voice output permission and turn/context currency before Inworld generation and delivery/playback. Stop or revocation invalidates late results.

Keep one active turn per session. Default limits from the spec: 15 seconds/2 MiB recording, 10 seconds per cloud call, configurable 20-second turn deadline after recording. Local scans use 10,000 characters/batch; cloud excerpts use at most 2,000 characters. Configure limits centrally and measure actual outcomes. Recording/audio/transcripts do not become durable app records.

Mock adapters implement the same contracts with explicit provenance and deterministic outcomes. They must never authorize production calls. For live adapters, record SDK/API version, documented permission mapping, supported formats, retention configuration, test date/mode, sanitized result and unresolved issues. Documentation review alone is not verification.

## Purchase boundary (W14)

Flow: the child's request reaches our backend → the backend applies the parent's policy → when approval is needed it calls k-ID `POST /transaction/request-purchase` → k-ID emails the parent, who answers in Family Connect → k-ID calls `POST /api/webhooks/kid` with `approved`, `denied` or `expired` (24-hour expiry) → on approval, or when under the monthly limit, the backend charges the parent's saved method through FastSpring → FastSpring calls `POST /api/webhooks/fastspring` with the result → when notify-after-purchase is on, the backend reports the purchase to k-ID with `POST /transaction/push`.

1. Card entry happens only in FastSpring's hosted checkout. Our code never receives, stores or logs card numbers.
2. k-ID never processes or blocks payments; our backend enforces every decision. Denied, expired, disabled or unanswered requests never charge.
3. Prices come from our server catalog. Only Ozone Layer's own catalog is purchasable; we never charge for other companies' products.
4. Webhook checks use the raw request body, before JSON parsing, with a constant-time comparison. k-ID: lowercase hex HMAC-SHA256 of the timestamp header followed by the body, in `X-Signature-Hmac-Sha256` with `X-Signature-Timestamp`. FastSpring: base64 HMAC-SHA256 of the body in `X-FS-Signature`. Both can deliver the same event more than once, so handlers ignore repeats.
5. Recheck the policy, the monthly total and the request state right before charging, inside one transaction, so a repeated webhook or a race can't charge twice.
6. FastSpring runs in test mode only. Two behaviors are unconfirmed (spec 13.1): charging a varying amount to a saved method, and saving a card without a purchase. Until confirmed, the charge step may use FastSpring's documented simulated charge, labeled as simulated.

Provider secrets (`KID_API_KEY`, `KID_WEBHOOK_SECRET`, `FASTSPRING_API_USERNAME`, `FASTSPRING_API_PASSWORD`, `FASTSPRING_WEBHOOK_SECRET`) stay server-side and never appear in browser bundles.

## Handoff rules

The backend role (Harsh) owns sessions, capabilities, purchase policy, webhooks and persistence; the experience role (Joseph) owns extension and companion UI, including the parent and purchase screens; the AI/voice role (Angela with Joseph) owns provider reasoning/audio adapters. Shared-schema changes require review from the consumer. Each PR includes the task ID, contract impact, fixture, reproduction steps, tests actually run, provider mode and remaining blockers.

Integrate against one agreed P01/P16 fixture pair before expanding the catalog. Use deterministic implementations at a documented boundary while waiting on another task, and preserve honest mode labels. A blocked live adapter does not block independent local detection, accessible UI, curated learning, or negative-case tests.
