# Ozone Layer local integration and demo handoff

Current local demo implementation and live diagnostic evidence are recorded in [DEMO.md](DEMO.md). Historical snapshot/status notes below are retained; they must not be treated as the current completion record. The team W14 parent-purchase plan remains in force.

Audit date: 2026-10-21. Branch: `feat/ozone-integration`. Worktree: sibling `one-world-every-age-integration`. This is a local review branch, not team main. No push, deployment, publication or live vendor operation was performed.

## Recorded inputs

| Input | Exact commit / state |
| --- | --- |
| Original local HEAD / fork `feat/backend-permissions` | `652a1f32a7568109e6bbf4ded360b36c37ff4e88` |
| Local source checkpoint including uncommitted implementation | `11d381dbd6b52e7a3278162cb899edef25289270` (22 explicitly selected source/doc paths; four previously untracked provider/test files) |
| Team `main`, initial fetch | `3363d7e594b86abdc6f0b69b2d8a9c427136e317` (foundation PR #4) |
| Fork `main`, initial fetch | `97675eceedd2c3f722751fd5e81fb5f34106055a` (older than team main) |
| Team PR #5, open/unmerged at audit | `0e7fe62b194be523528038b4180cc2d9a292a2e8` (`docs/ozone-layer-payments`) |
| Team PR #6, open/unmerged at audit, stacked on #5 | `d428f5a34bbf0ea04045797851430c521e9789ce` (`feat/kid-age-gate`) |

Verified remotes: `origin` and `fork` point to `Harshvardhan-Garude/one-world-every-age`; `upstream` points to `jbisaccia-9/one-world-every-age`. The integration merges the recorded PR #6 head, which includes PR #5 and team main, with our checkpoint. Open PRs are local inputs here, not assumed merged. Run `git log --graph --oneline -8` and `git rev-parse HEAD` for the final integration commit.

The original checkout, original branch HEAD and staged/unstaged source files were preserved. No `.env`, credential, private SDK archive, browser profile or recording was read/copied into this worktree. The working `gemini-3.5-flash-lite` setting remains in the original ignored environment file, untouched. The standalone Gemini diagnostic documented in BACKEND.md remains historical evidence; it was not repeated and grants no k-ID approval.

## Functionality and contract audit

| Feature | Local work before merge | Team work inspected | Integration status | Remaining work |
| --- | --- | --- | --- | --- |
| Companion and extension | Fixture/evidence UI, manual activeTab shell; URL parser only | Mobile CSS/manifest, optional vendor widget proposal | Companion teaching is wired/tested offline; extension shell loads/responds | Extraction, local detector, warnings and owned extension-to-companion handoff |
| Onboarding and k-ID | W02 opaque bearer sessions, owned links, refresh, expiry, cancellation | Widget/claim callback; anonymous caller-ID session lookup | W02 preserved; claim remains explicitly blocked; session lookup now owner-bound | Confirm CDK vs Kai workflow, product mapping, claim redemption and real allowed/denied/revoked sessions |
| Assessments/explanation | Owned P01/P16 references and scripted/Gemini service routes | Public demo still used by UI | Companion now uses owned assessment and labelled scripted explanation | Connect real extracted findings and allowed provider-test UI |
| Quiz/feedback | Server-only keys and unscored practice routes | Public preview only | P01/P16 quiz and teaching feedback now wired/tested in browser | W09 independence, persistence, idempotent awards and badges |
| Gemini | Adapter, injected HTTP tests; one earlier standalone live success | Interface only | Adapter/boundary unchanged; no new live call | Genuinely authorized P01/P16 application route and live quality/error checks |
| Speech output | Inworld adapter and protected stored-explanation route, simulated tests | Widget voice flag visibility only | Explicitly unavailable without settings; text remains usable | Credentials/model/stock voice, Play/Stop/captions/replay/mute and live verification |
| Voice input | Contract/interface only | Adult-presenter data-policy clarification | Missing; no microphone or recording path added | Modulate credentials, documented redaction parser, bounded upload and cancellable turn orchestration |
| FastSpring | Deferred status and variable names | W14/spec 13.1 purchase plan and storefront format | Planning only, no checkout, charge or webhook implementation | After core safety flow: sandbox setup, adult policy/approval, hosted checkout, signed webhook/idempotency tests |
| Shared/startup contracts | Strict W02 and teaching schemas, loopback CORS, Node 22/npm workspaces | Private SDK hard dependency, two k-ID base variable names | Fresh offline install works; additive owned-response schema consumed; Authorization CORS preserved | Joint consumer review; optional widget needs the genuine private SDK and separate type/build verification |

## Conflicts and semantic fixes

Eleven files had Git conflicts: `.env.example`, spec, README, API main/server, companion main/index, extension build/popup, FOUNDATION and WORK_PLAN. Display branding was reconciled; team mobile metadata/CSS, named roles, spec v1.2 purchase/stretch requirements, adult-presenter policy and extended bundle/secret guards were retained. Runtime/backend truth replaced stale "not started" documentation.

The important clashes were semantic as well as textual:

- The widget globally gated all fixture UI, so a missing private tarball/key/email would prevent the offline demo. The default build now works without vendor assets and never mounts the widget automatically. The real widget source is preserved outside the default TypeScript input set, with an explicit optional build alias. It is **not part of the default typecheck/build or smoke result**; no SDK declarations or fake vendor state were invented.
- The original `/api/kid/session` accepted an arbitrary vendor UUID without an application bearer and used an independently configured base URL. It now takes only a W02 bearer and `{contextVersion}`, refreshing the server-owned link and returning the W02 session view. Browser `sessionId` fields are rejected before any vendor request. Tests exercise ownership, sanitized failure and no approval on refresh failure.
- `/api/kid/claim` preserves `202`, `redeemed: false` and no token retention/echo. It creates no application authorization. Completing the widget still cannot enter a protected route without the separate W02 session.
- Widget permissions (`ai-chat`, `ai-voice-mode`, purchases) are not equivalent to W02's combined cloud consent, media-generation/upload and memory requirements. Do not infer those grants or change `KID_AI_MAPPING_CONFIRMED` to work around the mismatch. Harsh/Joseph must agree the actual provider workflow and bound claim contract.
- The private SDK file dependency would make a fresh `npm ci` fail. It was removed from the default dependency graph/lock; optional installation uses the genuine privately supplied archive and is never faked. Default installation was verified with the cached public lockfile.
- The companion previously submitted no answer and used public deterministic demo owners. It now creates an opaque application session, validates owner/mode/version, requests an owned assessment, explanation and quiz, and submits only an answer reference. Credentials remain in memory; cleanup aborts work and logs out. Stale/expired state requires reloading the example. There is no client grading or provider-to-demo authorization shortcut.
- `KID_API_BASE` remains W02's fixed Test Mode base. The team's `KID_API_BASE_URL` is retained as a reserved purchase-planning name and cannot override that boundary. Existing `@beacon/*`, `BEACON_*`, message IDs and storage keys were preserved.
- CORS still allows only configured loopback/extension origins, with Authorization preflight; it never replaces bearer authentication. The extension still makes **no** backend assessment call or credential transfer. Its current "Open companion demo" button is navigation only.

`apps/api/src/backend.ts`, `kid.ts`, `gemini.ts`, `inworld.ts` and `provider-http.ts` are unchanged from the preserved local checkpoint. In particular, `withAuthorizedOperation`, `context.assertCurrent()`, `executionMode`, ownership, permission refresh, cancellation and late-response rejection remain intact.

## Verification and immediate demonstration

On Node 22.20.0 / npm 11.6.1:

| Check actually run | Result |
| --- | --- |
| `npm ci --offline` | Passed using cached packages, without private SDK; initial restricted esbuild subprocess attempt required normal approved execution |
| `npm run typecheck` | Passed (default application; optional private widget excluded) |
| `npm test` | 71 passed; original 67 plus four reconciled widget-route tests; all provider responses injected |
| `npm run build` | Passed for all workspaces; existing Zod/Rollup annotation warnings only |
| `npm run check:bundles` | Passed on 11 assets; no server-only answer/secret markers |
| `npm run test:smoke` | Passed against built API/companion and actual unpacked MV3 extension |
| Browser teaching coverage | Child/teen/adult, P01/P16 correct and incorrect feedback, ambiguous comparison, synthetic labels, no mastery credit, stale-context recovery, reset, preferences, 390px width, inert fixture pages |
| Session privacy/ownership | Browser storage and navigation contain no bearer; W02 HTTP logout/replay and cross-owner tests pass |
| Live vendors | Not called; no new live claim or authorization evidence |

Immediate demo: open the companion, choose a synthetic persona, inspect P01's request/address evidence, check an answer and read feedback; switch to P16 to show context-aware teaching and an ambiguous variant. Toggle large/plain text, reset and demonstrate the same flow at phone width. Load the extension, show its worker connection/manual-access notice and open the companion. Explain that the notice is access confirmation, not threat detection.

Still manual/unverified: positive toolbar activeTab injection and dismissal on a real HTTP tab (headless popup navigation does not grant activeTab), real mobile Safari/Android devices, optional vendor widget/private SDK, genuine k-ID/claim binding, protected live Gemini route, Inworld audio/playback, Modulate input/redaction and FastSpring.

## Ranked plan and next three tasks

1. **Frontend Joseph, backend Harsh (W03/W05):** implement bounded visible-content extraction and P01/P16 local detection, exclusions/deduplication and dismissible notices; hand an owned assessment to the companion without excerpts or bearer credentials in URLs. Acceptance: actual toolbar → P01 concern / P16 educational comparison → companion → server-checked quiz, tested in the real extension.
2. **Backend Harsh, frontend Joseph (W02/W04/W06):** confirm the real k-ID workflow and permission mapping with the configured product, reconcile Kai widget claims with CDK ownership, then implement the documented claim-to-application binding or use the verified supported onboarding workflow. Add application onboarding/opt-in UI. Acceptance: genuine allowed session reaches existing Gemini coaching; denied, pending, revoked and stale sessions dispatch nothing. A standalone Gemini success does not satisfy this gate.
3. **AI/voice Angela with Joseph, backend Harsh (W07 then W08):** obtain Inworld credentials/model/stock voice and wire explicit Play/Stop/captions to the stored-explanation route, test stop/revocation/error paths, then obtain Modulate access and implement redaction-first bounded push-to-talk. Acceptance: output works first; full voice input waits for real redaction and no raw fallback. Keep text usable throughout.

After the first core safety demo: finish W09 progress/unique awards and W10 privacy cleanup, add P08 and the remaining fixture/detector coverage, then W14 FastSpring sandbox purchases (Harsh backend policy/ownership/signatures/idempotency; Joseph adult screens/hosted checkout; Angela coordinates provider access and rehearsal). Confirm actual k-ID purchase controls and FastSpring saved-method/variable-charge contracts before implementation or live charges. Denied/expired approvals must never charge. W15 learning game is last/stretch.

Shared-file review handoff: Harsh/Joseph jointly review `packages/contracts/src/index.ts`, `apps/api/src/server.ts`, `apps/companion/src/learning.ts` and the optional widget boundary before publishing a PR. Angela/Joseph reuse the existing provider interfaces; do not add parallel session/permission services. No teammate branch or remote PR was changed by this local integration.

## Exact run commands

From the original checkout:

```bash
cd ../one-world-every-age-integration
npm ci
npm run dev
```

No credential file is needed. Companion: `http://127.0.0.1:5173`; API: `http://127.0.0.1:8787/health`; controlled pages: `http://127.0.0.1:8787/fixtures/P01` and `/fixtures/P16`. Ctrl+C stops both children. Do not copy or replace the original `.env`. If a later authorized provider check needs its existing settings, the server runner can reference it in place (without moving it):

```bash
node --env-file=../one-world-every-age/.env scripts/dev.mjs
```

This command was **not run during the integration audit**. Keep the default offline UI unless a genuine provider-test session is established.

Build/load the extension:

```bash
npm run build
```

Open `chrome://extensions` → Developer mode → Load unpacked → select this integration worktree's `apps/extension/dist`. Reload it after rebuilds. Open a controlled fixture tab, invoke its toolbar popup, choose **Show current-page access**, inspect/dismiss the notice, and choose **Open companion demo**. The button does not transfer a finding yet. Extension API calls will additionally need the popup's exact origin in `BEACON_EXTENSION_ORIGINS`; allowlisting alone grants no session authority.

## Optional k-ID widget

The default offline build requires none of these steps. Once a teammate has privately provided the SDK, its source and licensing are approved, and the test product/config declaration is intentional:

```bash
npm install --no-save --package-lock=false ./vendor/k-id-core-web.tgz
BEACON_KID_WIDGET_ENABLED=true npm run dev
```

The build alias loads `integrations/kid/widget.tsx` only with the explicit flag and real installed package. `VITE_KID_PUBLISHABLE_KEY`, `VITE_KID_BASE_URL` (test endpoint) and `VITE_KID_SUPPORT_EMAIL` are the existing public browser settings; secret `KID_API_KEY` remains server-only. Values belong in private local configuration, never source. Clicking **Open k-ID test widget** can declare vendor product settings; it was not clicked or enabled here. Missing key/email yields setup information, and closing it restores offline teaching. Claim redemption remains blocked even if the widget completes. The preserved widget must receive its own typecheck/build/browser/live review with the actual SDK before anyone calls it verified.

## Final fetch

The single final fetch after validation found no newer commits: team main remained `3363d7e594b86abdc6f0b69b2d8a9c427136e317`, PR #5 head remained `0e7fe62b194be523528038b4180cc2d9a292a2e8`, PR #6 head remained `d428f5a34bbf0ea04045797851430c521e9789ce`, and fork main remained `97675eceedd2c3f722751fd5e81fb5f34106055a`. Both PRs were still open in the final GitHub read. No ongoing merges were chased. The original HEAD, index and all 22 checkpointed source/document hashes were rechecked unchanged without reading/hashing `.env`.
