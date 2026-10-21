# Ozone Layer demo runbook

This is a reviewable **local integration**, not team main or a published extension. The offline safety/learning scenes work together. Full vendor-authorized voice, browser claim redemption and W14 parent-approved saved-method purchases remain blocked. Connectivity diagnostics are separate from application authorization.

## Included work and coordination

- Branch: `feat/ozone-demo`; directory: the sibling `one-world-every-age-integration` checkout.
- Preserved integration base: `7a25034c1816e404796602c087e23493d1282a82`.
- Preserved original backend HEAD: `652a1f32a7568109e6bbf4ded360b36c37ff4e88`; its 22 uncommitted source/document files were previously checkpointed as `11d381dbd6b52e7a3278162cb899edef25289270` and are included through the integration base. The original working tree was not rewritten.
- Recorded team main: `17d69b8f361fafad9d307258ce39110067c85ee3`. PRs #5/#6 are merged. Its tree equals the already included PR #6 tree `d428f5a34bbf0ea04045797851430c521e9789ce`; squash ancestry was reconciled at `d8ae174d3b4514ca9168b1241acff75da94c12fc`, preserving the reviewed W02 and optional-widget corrections.
- Fork main: `97675eceedd2c3f722751fd5e81fb5f34106055a`; it is not the integration source of truth.
- Shared review: **Harsh + Joseph** own the additive contracts, HTTP routes, handoff and widget/session boundary. **Angela + Joseph** review voice capture, captions and the reused Gemini/Inworld adapters. **Harsh + Joseph**, coordinated by Angela, retain the W14 purchase plan below. No new competing provider/session service was introduced.
- GitHub lists no open PRs at the integration snapshot. Posting the coordination handoff to PR #6 was attempted, but the connector returned `403 Resource not accessible by integration`. No comment was posted; share this local runbook with Joseph/Angela before parallel changes to these shared files. No teammate acknowledgement is claimed.

## Start the offline demo

From the original checkout:

```bash
cd ../one-world-every-age-integration
npm ci
npm run dev
```

Node 22.20.0 is the verified release. Companion: **http://127.0.0.1:5173**. API health: **http://127.0.0.1:8787/health**. Fixture pages: `/fixtures/P01`, `/fixtures/P10`, `/fixtures/P16` on either local origin. Ctrl+C stops both servers. The offline flow needs no credentials and does not call vendors.

Local anonymous progress persists in `.local/progress.sqlite` (ignored). Tests use memory or temporary databases. The browser stores only an anonymous **progress-only** resume token under `ozone.progress.resume`; application bearer credentials stay in companion memory. Use **Reset learning progress** to delete this identity's credits, attempts and challenge runs on this server. **Forget this browser’s progress** removes its resume token. This is not account-level anti-abuse; clearing/sharing tokens can reset/share anonymous progress. No recordings, transcripts or browsing excerpts enter the database.

The original credential file remains in place. To use its existing settings without copying or overwriting it:

```bash
node --env-file=../one-world-every-age/.env scripts/dev.mjs
```

The provider panel requires an explicit action and a separate server-owned provider-test session. Starting the app does not make a vendor request. Do not enable mapping/retention flags merely to make a demo pass.

## Build and load the extension

```bash
npm run build
```

In Chrome, open `chrome://extensions`, enable **Developer mode**, select **Load unpacked**, and choose this integration checkout's **`apps/extension/dist`**. Reload it after every rebuild.

1. Open `http://127.0.0.1:8787/fixtures/P01` and invoke Ozone Layer from the toolbar.
2. Select **Show current-page access**. The built content script recognizes only exact, visible controlled P01/P10/P16 fixture text and destination metadata on loopback fixture URLs. It highlights the destination and shows evidence, uncertainty and a safe next action. P16 remains a comparison without a keyword-based fraud accusation. Hidden/editable/form content is excluded. General browsing detection and automatic monitoring are unavailable.
3. For the owned handoff, copy the nonsecret **extension origin** from the popup's **Local connection** details. Restart the app with that exact origin, without changing the credential file:

```bash
BEACON_EXTENSION_ORIGINS=chrome-extension://<actual-extension-id> npm run dev
# Or reference the existing credential file in place:
BEACON_EXTENSION_ORIGINS=chrome-extension://<actual-extension-id> node --env-file=../one-world-every-age/.env scripts/dev.mjs
```

4. Check the fixture again, choose **Open owned fixture lesson**, and grant access to the local companion origin when Chrome asks. The extension creates a local-demo session and owned assessment. Its worker retains the bearer only in `chrome.storage.session` to survive worker suspension. A one-time 45-second fixture ticket opens the companion; the fragment is removed immediately and redeemed into a **new assessment owned by the companion session**. The ticket transfers fixture selection, not provider permissions. It contains no excerpts or application bearer. Used, expired, signed-out or stale-context source references cannot redeem.
5. If the connection grant/CORS setup is missing, the on-page explanation still works and **Open companion demo** remains available. Allowlisting is not authorization. No required host permissions or automatic content scripts were added.

Browser automation loaded the actual unpacked extension and exercised its worker/popup and restricted-page rejection. It also executed the actual built content artifact on P01/P10/P16 and exercised HTTP handoff through the actual companion. **The positive toolbar/activeTab grant and optional host-permission prompt still need the manual steps above**; scripted content execution is not evidence that Chrome granted activeTab.

## What works together

| Feature | Current combined behavior | Verification / limit |
| --- | --- | --- |
| Child scene | Fictional child, 11; P01 evidence, parsed illustrative destination, simple explanation, trusted-adult/independent-app advice | Browser and regression tests. No real child's data or vendor age approval |
| Susan scene | Fictional Susan, 68; P10 toll deadline + payment request + highlighted destination, uncertainty about any debt, independent account/statement advice | Browser and deterministic tests. No actual email access or bill verification |
| P01/P16 teaching | Owned assessment → scripted explanation → short quiz → server-checked feedback | Existing regressions retained, including all personas/variants, ownership and stale-context rejection; teaching earns no mastery credit |
| Curated learning | Nine distinct curated scenarios; observation + reason + action required; server-only rubrics | SQLite transactions, owner/progress identity + stable credit-key uniqueness and idempotency keys; first independent correct answer only |
| Badges/status | Exact spec 10 thresholds, including First Safe Step, financial/privacy/claim/careful judgments and category-spanning Safety Guide | Replay/concurrency cannot duplicate credit. Reveals and any feedback make later attempts practice-only. No purchases or live flags award credit |
| Consent transition | Explicit offline cloud opt-in on → off; version changes and old assessment is rejected | Actual browser/server test. This is accurately labelled user consent withdrawal, **not** a real jurisdiction comparison or k-ID approval change |
| Provider onboarding | Separate explicit CDK Test Mode start/refresh bound to an application bearer; pending genuine challenge link if returned | Owned routes implemented; live active-session/product mapping not verified. CDK presets remain 8/15/34; fictional scene ages 11/68 do not assert vendor age verification |
| Voice | Talk checks server eligibility before microphone; bounded capture → Modulate redaction → existing Gemini → existing Inworld, exact captions; Stop/navigation cancel and discard late output | Automated simulated HTTP pipeline, permission, failure and cancellation tests. Browser Talk/no-auto-listening/mic-denial/Stop tested with an explicitly simulated ready response. Full live voice remains blocked |
| Purchase denial | Only server catalog item `ozone-theme`, USD 1.00. Local/child contexts are blocked with zero checkout and zero charge calls | Backend, HTTP and actual browser checks; no interception of another game's payment forms |
| Eligible adult checkout | Documented FastSpring Sessions v2 adapter always sends `live:false`, validates own product/total/returned host/test state, reserves idempotency before dispatch | Simulated response tests only. Requires genuine bound adult/purchase grant + confirmed mapping + configured sandbox catalog; no live checkout/order/payment demonstrated |

Curated badges: First Safe Step = one credit; Scam Pattern Spotter = three distinct financial scenarios; Privacy Protector = two privacy scenarios; Evidence Explorer = two claim scenarios including insufficient evidence; Careful Thinker = two legitimate/ambiguous scenarios. Explorer starts at zero, Learner at three, Safety Guide at six spanning three categories. Progress is learning, not certification.

## Provider evidence and configuration

Sanitized evidence is in [verification/provider-connectivity-2026-10-21.jsonl](verification/provider-connectivity-2026-10-21.jsonl). No response text, audio or credentials were saved. These **isolated diagnostics** did not construct an authorization context, create an application approval, dispatch the protected coach, or create an order.

| Provider | Real diagnostic | Application configuration / remaining verification |
| --- | --- | --- |
| k-ID | Secret-key Test Mode requirements GET: HTTP 200, requirements parsed | `KID_API_KEY`, `KID_WORKFLOW`, `KID_API_BASE` configured. `KID_PRODUCT_ID` missing; `KID_AI_MAPPING_CONFIRMED` unconfirmed; `KID_PURCHASE_MAPPING_CONFIRMED` absent; `KID_WEBHOOK_SECRET` missing. Active session, actual configured product mapping, guardian link and approval remain unverified |
| Gemini | Historical successful fixed-fictional-text diagnostic preserved; model access and JSON/evidence/caption parsing passed | Existing `GEMINI_API_KEY` and **working `GEMINI_MODEL` preserved**. No repeat live call. Protected application reasoning still awaits genuine k-ID authorization |
| Inworld | System voices GET and one fixed fictional MP3 synthesis: HTTP 200, canonical audio parsed. Diagnostic used official `inworld-tts-2` and returned system voice `Aanya` | `INWORLD_API_KEY` configured. `INWORLD_MODEL_ID` / `INWORLD_VOICE_ID` missing, so application speech stays **not configured**. Diagnostic selections were not written to configuration. Audible playback/caption alignment in the live application still unverified |
| Modulate | The in-memory synthetic Inworld clip reached batch redaction: HTTP 200, multipart metadata/audio parsed. No transcript was sent to Gemini | `MODULATE_API_KEY` configured; `MODULATE_RETENTION_CONFIRMED` absent. Application adapter stays **not configured** pending retention/entitlement confirmation. Short diagnostic does not establish PII-redaction accuracy or retention |
| FastSpring | Basic-auth read-only catalog GET: HTTP 200, response parsed. **Zero checkout/charge calls, no order** | API username/password configured. Existing `FASTSPRING_STOREFRONT` has unsupported test-popup format and was preserved. Confirm `FASTSPRING_CHECKOUT_PATH` (`store/web-checkout` etc.), `FASTSPRING_PRODUCT_PATH` for our USD 1 theme, `FASTSPRING_SANDBOX_CONFIRMED`; webhook secret missing. Actual sandbox checkout/order/webhook not verified |

The successful diagnostic's Inworld selection can be supplied to one local process without writing any credential file:

```bash
INWORLD_MODEL_ID=inworld-tts-2 INWORLD_VOICE_ID=Aanya node --env-file=../one-world-every-age/.env scripts/dev.mjs
```

This resolves the missing model/voice settings for that process only. It does not enable k-ID mapping or confirm Modulate retention, so it cannot bypass the remaining application-authorization blockers.

`BEACON_COMPANION_ORIGIN` is configured; `BEACON_EXTENSION_ORIGINS` is missing. All existing `@beacon/*`, BEACON names, IDs and provider settings are preserved. New variable **names**, never values, are in `.env.example`. Malformed/missing provider configuration fails closed without blocking startup.

Only rerun the diagnostic intentionally; it makes one synthetic TTS/redaction request when configured:

```bash
node --import tsx --env-file=../one-world-every-age/.env scripts/provider-diagnostic.mjs
```

It bypasses application orchestration solely to test connectivity. It grants no app permission. Test-mode FastSpring uses the same documented API host as other modes, so the implementation explicitly requests and validates `live:false`; the diagnostic uses GET only.

## Private SDK and claim boundary

The privately supplied `vendor/k-id-core-web.tgz` was found in the original checkout and linked into the integration's ignored vendor directory. It is **not committed**. It is an optional local dependency, so the default offline build remains independent of it. `npm ci` installed `@k-id/core` 0.1.0; SDK typecheck, optional-widget build and browser boundary inspection passed:

```bash
npx tsc --noEmit -p integrations/kid/tsconfig.json
BEACON_KID_WIDGET_ENABLED=true npm run build --workspace=@beacon/companion
npm run check:bundles
```

The bundled README documents `onClaim(claimToken)` after a passed **or pending** age check. Bundled `dist/types/fapi-schema.d.ts`, `CheckAgeGateResponse.claimToken`, says the one-time token lasts ten minutes and names `/client/claim`. **There is no server claim path/request/response/authentication definition in the bundled paths, client or README.** Public official docs likewise did not resolve it. Installing the SDK resolves installation, not claim redemption.

Therefore `/api/kid/claim` continues returning `202`, `redeemed:false`. No guessed endpoint or arbitrary browser session ID is promoted to ownership. Harsh/Joseph need the vendor-confirmed server host, auth, request/response, one-time-use behavior and browser-flow-to-current-owner binding/replay rules. Do not replace that gap with `/session/get` on an untrusted caller-supplied UUID.

Optional widget startup needs the existing `VITE_KID_PUBLISHABLE_KEY` and `VITE_KID_SUPPORT_EMAIL`; `VITE_KID_BASE_URL` defaults to the SDK's test FAPI host. `BEACON_KID_WIDGET_ENABLED=true` exposes an explicit button. **Opening the widget can declare the reviewed test-product permissions/settings**; it was not opened live and no declaration was made during this integration. Offline access remains outside the gate.

## W14 boundary and remaining tasks, in dependency order

The team's current spec 13.1 remains the purchase design. The new optional adult hosted checkout is a limited independent sandbox capability; it does not establish or replace parent-approved saved-method charging. Child policy is **off**. No charge adapter, invented simulated charge, unsigned webhook or fake parental approval is exposed.

1. **Harsh + Joseph, vendor mentor:** resolve the browser claim exchange and owner binding; confirm configured CDK/AI/purchase mappings and genuine active/guardian sessions. Test replay, cross-owner claims and revocation using actual documented contracts. Then verify the existing protected Gemini route. This blocks a full vendor-authorized app demo.
2. **Angela + Joseph, Harsh:** confirm Modulate retention/redaction access, explicitly configure an available Inworld model/voice, and rehearse permitted adult Talk → redaction → Gemini → audio/captions with synthetic text. Verify real microphone denial, Stop during each live stage, playback permission refresh and redaction quality; do not record children. No automatic listening.
3. **Joseph + Harsh:** manually grant the real toolbar activeTab/local connection, check P01/P10/P16 notice/dismissal and owned handoff in Chrome, then review shared schema/UI changes together. No general detector or automatic background monitoring claim.
4. **Harsh + Joseph, coordinated by Angela:** W14 genuine verified parent-child link; adult-admin policy editing (off / approve each / monthly limit, over-limit behavior, notifications); confirmed Transactions/Purchase Controls entitlement; signed, replay-safe purchase approval and FastSpring webhooks; transactional monthly accounting; confirmed saved-method/variable-charge APIs. Pending/denied/expired/disabled approvals must never checkout/charge. Do not silently substitute the adult checkout for this work.
5. **Harsh + Joseph:** confirm our sandbox checkout/product and test-only catalog price; complete one eligible hosted sandbox checkout with synthetic details and documented test card, verify signed completion and order ownership. Basic protection, lessons and badges remain free. No production payment.
6. **Joseph / Angela:** real mobile Safari/Android and accessibility rehearsal; optional general manual-text detection, dynamic-page lifecycle and the remaining scenario families follow the first demo. A genuine jurisdiction difference requires real configured provider evidence; the labelled consent transition is available immediately.

The next three concrete actions are items 1–3. Independent local implementation is complete for the offline scenes, curated learning, handoff, consent transition, voice orchestration/failure handling and sandbox adapter/policy boundary. Live verification and the unresolved W14 prerequisites remain explicitly separate.

## Rehearsed two-minute script

Use the default offline build. Complete the manual extension grant/CORS preparation before presenting, or start directly in the companion and disclose the extension grant is pending.

- **0:00–0:30:** Select **Child · fictional age 11**, P01 baseline, and **Plain language**. Point to the credential request and highlighted actual destination metadata. Say: “This controlled example asks for a password and sign-in code. Keep both private and open the game independently.” The actual tab is loopback; the `.example` address is explicitly illustrative.
- **0:30–0:45:** Click **Try restricted demo purchase**. Show `blocked_by_policy`, **Checkout calls: 0. Charge calls: 0.** Explain that this is our optional theme catalog; Ozone Layer cannot purchase another game's credits.
- **0:45–1:10:** Choose **Susan · Toll email**. Point to the deadline, card request and `toll-notice.example`. Explain: “We cannot establish whether a toll is owed. Check your usual account or call a number from a genuine statement; do not follow this email link.” Voice is not secretly playing; show text first. If asked about live voice, show the separate diagnostic evidence and current authorization/configuration blockers.
- **1:10–1:40:** Click **Start curated practice**, select a new challenge, and choose an observation, evidence-based reason and independent safe action. Submit once: **First Safe Step**, one credit. Submit again: no new credit. This is server-checked learning, not a prize or a claim that the person is safe.
- **1:40–2:00:** Click **Demonstrate consent withdrawal**. Show the new server context version and rejection of the old assessment. Say: “This is an offline user-consent transition, not a verified country-law difference.” Finish on the provider-status table and disclose the remaining full-flow blockers.

For a fresh rehearsal use **Reset learning progress** before the timer and **Reset demo** for the scene controls. Do not reveal a challenge answer before the independent attempt. Existing teaching quizzes always remain unscored.

## Validation record

The final check results and final fetch are appended below after verification. Automated provider fixtures are simulated HTTP, never reported as real vendor connections. The separate real diagnostic is described above. Required checks: `npm run typecheck`, `npm test`, `npm run build`, `npm run check:bundles`, `npm run test:smoke`; optional real-SDK typecheck/build were also run. No main merge, push, deployment, extension publication, vendor configuration write or payment was performed.

Official contracts reviewed: [k-ID session get](https://docs.k-id.com/api/endpoints/get-session), [k-ID permissions](https://docs.k-id.com/concepts/access-features-consent/permissions), [Modulate redaction](https://docs.modulate.ai/get-started/pii), [Inworld synthesis](https://docs.inworld.ai/api-reference/ttsAPI/texttospeech/synthesize-speech), [Inworld voices](https://docs.inworld.ai/api-reference/voiceAPI/voiceservice/list-voices), [Inworld models](https://docs.inworld.ai/tts/tts-models), [FastSpring Sessions](https://developer.fastspring.com/reference/sessions-overview), [FastSpring session creation](https://developer.fastspring.com/reference/createsession), [FastSpring authentication](https://developer.fastspring.com/reference/api-overview). Reading these contracts alone is not live verification.

Final validation (2026-10-21, Node 22.20.0):

- `npm ci --offline --no-audit --no-fund`: passed with the supplied optional private SDK. A separate temporary manifest install with `--omit=optional --ignore-scripts` also passed without an SDK archive.
- `npm run typecheck`: passed. The real optional SDK/widget typecheck and optional companion build also passed; no live widget mount or product declaration was attempted.
- `npm test`: **84 passed, zero failed/cancelled**. Includes existing P01/P16 regressions, P10 all personas/variants, transactional badge rules/persistence, owned handoff, zero-call purchase denial, simulated adult checkout, strict multipart redaction, speech fallback, permission and cancellation/late-result rejection. All automated provider responses are injected simulations.
- `npm run build` and `npm run check:bundles`: passed; 11 browser artifacts inspected, no private rubric fields, server entrypoints or provider secret-variable markers. Node SQLite emits an experimental-feature warning on the pinned Node release; build tools also emit benign third-party annotation warnings.
- `npm run test:smoke`: passed against actual built companion/API and unpacked extension. P01/P16 teaching, P10 evidence, unique badge/replay, consent invalidation, zero-call denied purchase, one-time HTTP handoff, 390px layout, stale-session recovery and Talk/microphone-denial/Stop UI all passed. The voice-ready response for the mic-denial UI check is explicitly simulated; no automated test called vendors. Built content recognition/dismissal was exercised separately from the real toolbar grant.
- `git diff --check`: passed. Original 22 checkpointed source/document hashes and staged-index hash match the preservation manifest. No credential file was hashed, copied, overwritten or staged. SDK archive, build artifacts and local database remain ignored.
- One final fetch after validation: team main still `17d69b8f361fafad9d307258ce39110067c85ee3`; fork main still `97675eceedd2c3f722751fd5e81fb5f34106055a`. No newer team snapshot required another merge.

Remaining manual/live checks: actual toolbar/activeTab and local host-grant interaction; full genuine k-ID claim exchange/product mapping; protected application Gemini/voice; real adult capture/playback/retention/redaction-quality checks; genuine jurisdiction difference (the labelled consent transition is tested); eligible sandbox checkout/order completion and signed webhooks; W14 verified parent, approval, policy/monthly ledger and saved-method contracts; real Safari/Android devices. These are not claimed as passed.

Final extension review corrected Vite’s discarded script-completion value: the popup now reads a bounded result from Chrome’s isolated content world, clears stale handoff controls and checks that the tab URL is unchanged. The built-artifact browser regression verifies this result channel; the actual positive toolbar grant remains manual.

Pre-PR review added a regression for cached checkout-link delivery: permitted retries refresh authorization and reuse the original checkout, while a subsequent provider revocation rejects the cached link without making another checkout call. Session/version, ownership and cancellation are checked again immediately before returning new or cached checkout output.
