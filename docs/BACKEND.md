# W02 backend sessions and permission handoff

Scope: application authentication, owned fixture references, documented k-ID CDK Test Mode adapter and a protected-operation service boundary. Gemini, Inworld, Modulate, billing, detection, grading and UI onboarding are not implemented by this PR. The public W00/W01 demo remains anonymous and unchanged. Foundation PR #4 is merged; this branch starts from its merged successor.

## Actual status and blockers

The local backend works without vendor keys: it issues application credentials, creates private synthetic fixture references, exposes normalized capability state, and invalidates/logout sessions. In `provider-test` mode without k-ID configuration, creation succeeds with a credential and `onboardingState: unavailable`; explicit refresh returns sanitized `503 UNAVAILABLE`. No old approval permits execution after refresh failure.

The CDK adapter is implemented but **not live verified**. This checkout has no `.env`, k-ID key, product configuration or selected event workflow. Runtime k-ID status is therefore **not configured**. The event team must confirm whether its product uses Kai or standard CDK, supply a Test Mode key locally, configure the AI permissions, and exercise a genuine permitted/denied test-session pair. No successful vendor request, hosted verification, legal compliance, webhook or production identity assurance is claimed. No vendor account/configuration was changed. Other providers remain not configured; FastSpring remains deferred.

## Session lifetime and ownership

- `POST /api/onboarding/session` issues a 256-bit random opaque bearer credential once, and an independent random owner ID. Only the SHA-256 credential hash is retained. Neither the public `demo:child` label nor a k-ID reference authenticates a Beacon request.
- Application sessions have a fixed **30-minute** lifetime and no sliding renewal. This is Beacon's policy, not a k-ID expiry. Store capacity is **1,000 sessions**; expired entries are pruned on access. Restart/signout invalidates credentials and in-memory state. Capacity exhaustion returns `429 LIMITED`.
- Each session holds at most **32 fixture references**, expiring after **five minutes** or earlier with its session. References are opaque UUIDs, bound to owner and context version. No private read accepts a caller's owner or trusted assessment object. Cross-owner references return generic `404` without disclosing existence.
- All private requests need `Authorization: Bearer <application-credential>`, including local tools without an Origin header. Never put credentials in navigation URLs or logs. Response bodies use `Cache-Control: no-store`.
- Production mode is disabled. Public local-demo switches cannot promote themselves. A provider-test application session alone is not a permission grant; actual server-resolved vendor decisions, configured mapping and user opt-ins are independently required.

## Routes and shared schemas

Base URL: `http://127.0.0.1:8787` (or use the existing companion `/api` proxy). Bodies require JSON and are capped at 4,096 bytes. Unknown fields are rejected. `onboardingRequestSchema`, `contextUpdateSchema`, `refreshRequestSchema`, `ownedAssessmentRequestSchema` and `sessionViewSchema` are exported from `@beacon/contracts`.

| Route | Authentication / request | Result |
| --- | --- | --- |
| `POST /api/onboarding/session` | Public; start body below | `201`, credential plus session view; unavailable onboarding is explicitly labeled |
| `GET /api/capabilities` | Bearer; no body | Current session view/cached snapshot and readable reasons; the snapshot is informational, not a dispatch authorization |
| `POST /api/onboarding/context` | Bearer; `contextVersion` and `optIns`, `jurisdiction`, and/or `syntheticProfile` | Updated session view. Profile/jurisdiction correction restarts server onboarding, never edits grants |
| `POST /api/onboarding/refresh` | Bearer; `{"contextVersion": 1}` using the actual current version | Session view plus `changed`; polls only the bound vendor session/challenge. No link yields `503 UNAVAILABLE` |
| `POST /api/onboarding/logout` | Bearer; `{}` | `{"signedOut":true}`; cancels work and invalidates the credential |
| `POST /api/assessments` | Bearer; `contextVersion`, `fixtureId: P01/P16`, `variant: baseline/safe/ambiguous` | `201`, owned `assessment`, `referenceExpiresAt`, fixture metadata and public challenge |

```json
{
  "mode": "provider-test",
  "syntheticProfile": "adult",
  "jurisdiction": "US-CA",
  "optIns": { "cloudAnalysis": false, "spokenCoaching": false, "memory": false }
}
```

Use `mode: local-demo` for an authenticated offline fixture session; it never calls k-ID and cannot dispatch providers. Only three server-defined synthetic profiles are accepted; there is no real-DOB, email, uploaded-document or arbitrary age input. Jurisdiction input is synthetic test context, not a verified location. Stored sessions retain the profile ID and jurisdiction, not DOB. Test samples are fictional, not legal age thresholds.

Example requests (replace placeholders locally; do not paste credentials into chat):

```bash
curl -sS http://127.0.0.1:8787/api/onboarding/session \
  -H 'Content-Type: application/json' \
  -d '{"mode":"local-demo","syntheticProfile":"adult","jurisdiction":"US-CA","optIns":{"cloudAnalysis":false,"spokenCoaching":false,"memory":false}}'

curl -sS http://127.0.0.1:8787/api/capabilities \
  -H 'Authorization: Bearer <application-credential>'

curl -sS http://127.0.0.1:8787/api/assessments \
  -H 'Authorization: Bearer <application-credential>' \
  -H 'Content-Type: application/json' \
  -d '{"contextVersion":1,"fixtureId":"P01","variant":"baseline"}'

curl -sS http://127.0.0.1:8787/api/onboarding/logout \
  -H 'Authorization: Bearer <application-credential>' \
  -H 'Content-Type: application/json' -d '{}'
```

The issued response contains `credential` only on creation. Other fields are `ownerId`, `mode`, `contextVersion`, `syntheticProfile`, `jurisdiction`, `optIns`, `applicationExpiresAt`, `onboardingState`, `capabilities`, `authorizationFreshness` and runtime `provider`. An outstanding challenge additionally returns its type/hosted URL with a Test Mode label; its ID/session association stays server-owned. Versions can increment during onboarding, refresh and correction; always use the returned version rather than assuming `1` for provider-test sessions.

Status/error distinctions: `401 UNAUTHORIZED` for credentials, `403 FORBIDDEN` for unmet policy, `404 NOT_FOUND` for unavailable owned references, `409 CONFLICT` for stale context or simultaneous transitions, `429 LIMITED` for bounded stores, and retryable `503 UNAVAILABLE` for failed vendor validation. Errors have sanitized `code/message/retryable/requestId`; malformed JSON/schema failures are `400` and oversized bodies `413`. CORS allows only configured origins with Authorization and Content-Type preflight; allowlisting an origin never authenticates it.

## k-ID configuration and documented contract

Server-only names in `.env.example`:

| Name | Purpose |
| --- | --- |
| `KID_API_KEY` | Product-scoped Test Mode key; never exposed |
| `KID_PRODUCT_ID` | Existing team product reference; not sent as an invented query field. Cross-product Account System Product headers are outside this standard-product adapter |
| `KID_WORKFLOW` | Set `cdk-test` only after confirming this is the actual event workflow; blank/unknown keeps the adapter unavailable |
| `KID_API_BASE` | Must exactly equal `https://game-api.test.k-id.com/api/v1`; other hosts, production and custom destinations are disabled |
| `KID_AI_MAPPING_CONFIRMED` | Set `true` only after confirming the configured product permissions against the mapping below. This flag grants no user permission |

Do not overwrite `.env`; load it locally and restart `npm run dev`. Requests use Bearer key authentication, fixed route allowlists, redirect rejection, 10-second per-call deadlines and 64-KiB response limits. No SDK or model dependency was added. A configured key is not a verified integration.

The adapter calls the documented [requirements](https://docs.k-id.com/api/endpoints/get-age-gate-requirements) and [age-gate check](https://docs.k-id.com/api/endpoints/check-age-gate) routes using server-defined synthetic data and an approved age collection method. It follows an immediate PASS with an actual [session/get](https://docs.k-id.com/api/endpoints/get-session) read, parsing the API reference's flat session shape. It never trusts a client PASS or vendor reference supplied in request JSON. The quick-start AI illustration has a different wrapper; that wrapper is deliberately not guessed into this adapter.

For a hosted challenge, it retains the bound ID and exact `https://family.k-id.com` URL and returns a labeled pending state. [Server-side polling](https://docs.k-id.com/api/endpoints/get-challenge-status) resolves only that challenge; PASS must be followed by session retrieval, and FAIL stays prohibited. There is no email-sending API, no webhook endpoint and no browser callback that grants approval. A user must use the supported Test Mode simulator/widget without real contact/identity collection; that interaction was not exercised here. OTP renewal/expired-link recovery is not implemented; start a new application session if the hosted test link expires.

Fresh unconditional session reads are used before dispatch/delivery. The documented `etag` is compared when supplied to invalidate a changed context; conditional 304 caching is not used. Vendor response expiry is not invented. If requirements say no age gate should be shown, this adapter reports unavailable: a default-permissions response is not fabricated into a linked session. Account System/Kai, unsupported age methods, permission upgrades and real-world onboarding need separate confirmed contracts. These are explicit live-flow limitations, not successful integrations.

## Capability mapping and Role C seam

Mapping is based on the [documented AI permission catalog](https://docs.k-id.com/get-started/quickstart-guides/ai-products), and must be checked against the configured product before enabling actual dispatch.

| Internal capability | Required source |
| --- | --- |
| `cloud_content_analysis` | Beacon app policy plus explicit cloud-analysis opt-in; never inferred from a vendor flag |
| `ai_coaching` | `ai-chat` |
| `voice_input` | `ai-chat` + `ai-voice-mode` + `ai-media-upload` |
| `voice_output` | `ai-voice-mode` + `ai-media-generation` |
| `uploads` | `ai-media-upload` |
| `conversation_memory` | `ai-memory`, plus memory opt-in when used |
| `permitted_guardian_sharing` | Denied by app policy for this iteration |

All required permissions must be explicitly enabled; a denial wins, missing is unknown, and pending/prohibited/failed validation never becomes approval. Duplicate or contradictory vendor permissions are rejected. Cloud app-policy eligibility may read allowed even when onboarding is unavailable; it cannot override state, missing vendor grants or user consent. Voice operations also require spoken-coaching opt-in. Chrome microphone access and explicit recording intent remain separate future client/voice checks.

Role C must use `BackendService.withAuthorizedOperation(credential, ownedAssessmentId, operation, contextVersion, dispatch, externalSignal?)`, not accept a ProviderContext from JSON. Operations are `coaching`, `speech`, `voice`, `uploads` and `memory`; the voice operation combines both input/output grant sets. The helper re-reads vendor state before dispatch and after completion, enforces ownership/current version/opt-ins, registers a cancellation signal and discards late responses. Call `context.assertCurrent()` between future provider stages. Output providers must speak only their owned validated explanation in W07; this helper is not a public arbitrary-proxy endpoint.

`ProviderContext` adds `executionMode` and async `assertCurrent()` to its prior owner/assessment/capabilities/version/signal fields. Real adapters must require `executionMode: provider-test`; `test-fake` exists only for injected test dispatch spies. Environment configuration cannot select a fake, and BackendService rejects injected fakes unless explicitly constructed for automated tests. `PermissionAdapter` now exposes start/refresh/status lifecycle methods, returning only validated vendor facts; ownership and capability construction belong to BackendService. The other reasoning/speech/redaction method signatures are unchanged.

Logout, expiry, version changes, revocation and failed refresh invalidate work. The operation wrapper propagates abort signals and checks state again even when a downstream test deliberately ignores abort. Its maximum deadline is 20 seconds, bounded by application expiry and any caller cancellation. There are at most 16 registered operations per session. Context/refresh mutations are serialized; stale/overlapping requests receive 409. Webhooks remain a future seam requiring actual authenticated public delivery; no localhost webhook success is claimed.

## Verification

Run unchanged setup and verification commands:

```bash
npm ci
npm run dev
npm run typecheck
npm test
npm run build
npm run check:bundles
npm run test:smoke
```

The test suite has **41 passing tests**: the original 15 plus 26 W02 tests. New coverage includes bearer invalidation/expiry, bounded session/assessment stores, cross-owner references, tampering, exact-origin Authorization preflight, pending challenge binding, actual documented response shape, deny/missing/malformed decisions, combined grants and opt-ins, provider timeout/response caps, wrong hosts/session IDs, logout/refresh races, context correction, and late-result cancellation. All vendor responses in automated tests use injected transport fixtures. No paid/downstream provider was called. Runtime audit emits only request ID, fixed stage, status code and duration; tests check that credentials and payloads do not appear.

Typecheck, all 41 tests, builds, browser bundle checks and companion/actual-unpacked-extension smoke passed. Browser regression also exercises private local-demo session creation, owned assessment creation and logout/replay through the companion proxy. The existing positive-toolbar manual checklist remains pending, separate from backend regression. Real k-ID permitted/denied session verification remains blocked on the configuration/access items above. A historical `verifiedSessionAt` would describe an actual successful test-session read only; current onboarding state/dispatch refresh must still allow the operation.

W02 backend code is reviewable, but W02's full live demonstration is not complete. Roles B/C can integrate the authenticated HTTP/service boundary immediately and keep their public demo paths. No merge, deployment, live production flow, real-person collection or extension publication is included.
