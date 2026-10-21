# W00/W01 foundation runbook

Historical foundation checkpoint, merged upstream in PR #4. W02 now adds authenticated backend sessions and owned fixture references; see [the current backend handoff](BACKEND.md). The remaining text records the original W00/W01 scope and results, rather than claiming W02 has no authentication.

This is the first implementation boundary. W02–W13 remain open. See the README for setup; this file records decisions, exact coverage and the handoff.

## Implemented layout

| Workspace | Entry point | Implemented scope |
| --- | --- | --- |
| `apps/companion` | `src/main.tsx` | React/Vite demo shell; typed API responses, evidence, safe action, question preview and presentation preferences |
| `apps/api` | `src/main.ts` | Native Node HTTP server on loopback; health, catalog, inert fixture pages and validated demo renderer |
| `apps/extension` | `build.mjs` | Vite builds popup HTML, ES-module worker and self-contained IIFE content shell into `dist` |
| `packages/contracts` | `src/index.ts`, Node-only `src/server.ts` | Zod schemas/types and fail-closed contract predicate |
| `packages/detection` | `src/index.ts` | Browser-safe scan interfaces and `tldts` URL interpretation; no detector |
| `packages/fixtures` | `src/index.ts`, Node-only `src/server.ts` | Six baseline/safe/ambiguous P01/P16 fixtures, contexts, public question and isolated rubric |

Node 22 LTS was available. npm workspaces and one lockfile coordinate the build. Shared exports resolve TypeScript source inside this private workspace; builds also emit JS/declarations under package `dist` directories. The API bundles workspace imports into `apps/api/dist/main.js`; companion assets are under `apps/companion/dist`. No public package distribution, database, additional framework or deployment system is added.

The unrelated untracked Next.js starter was preserved outside the checkout before scaffolding and was not adopted. CONTRIBUTING, the existing hook/CI and functional spec remain unchanged. `.env.example` gained empty Gemini placeholders and nonsecret local defaults. `.env` was not read, created or overwritten.

## Local API and configuration

All routes serve public synthetic data. There is no authentication/session issuance or protected feature execution. CORS checks exact configured origins; it is not user authorization. Requests without Origin are permitted for local tools because there are no private or mutating resources.

| Method/path | Request/response |
| --- | --- |
| `GET /health` | `status: ok`, `stage: foundation`, `mode: local-demo`, `productionAuthorization: false` |
| `GET /api/demo` | Provider states, three synthetic contexts and P01–P18 availability catalog |
| `POST /api/demo/assessments` | Strict request below; response validated by `demoResponseSchema` |
| `GET /fixtures/P01`, `GET /fixtures/P16` | Inert HTML; optional `variant=baseline`, `safe`, or `ambiguous`; no input/form collection or external requests |

```json
{
  "mode": "local-demo",
  "persona": "child",
  "fixtureId": "P01",
  "variant": "baseline"
}
```

Only child/teen/adult, P01/P16 and the three variants are accepted. Demo owner references are deterministically assigned from the public context, never accepted as authorization. Production ownership protection is not implemented. Requests require JSON and are limited to 4,096 bytes; unknown fields/modes return structured errors. This endpoint accepts no arbitrary URLs, page excerpts, credentials or recordings. Protected routes remain absent. Responses carry source/owner/context-version consistency; all generated capabilities are unknown/not-configured.

Defaults: `API_PORT=8787`, `COMPANION_PORT=5173`, `BEACON_COMPANION_ORIGIN=http://127.0.0.1:5173`, empty `BEACON_EXTENSION_ORIGINS`. Changing the companion port also requires changing its configured origin and rebuilding the popup. Only exact loopback HTTP companion origins and valid Chrome extension origins are accepted. Vite proxies `/api`, `/health` and `/fixtures` to the backend in development/preview. Production hosting is not configured.

## Contract invariants

- Modes are `local-demo`, `provider-test` and `production`. Provider provenance requires W02's documented mapping and authenticated sessions; schema validity alone establishes no identity.
- Capability decisions are allowed/denied/pending/unknown/expired. The helper rejects local-demo snapshots, empty requirements, stale context, expired decisions, unconfigured/demo provenance and non-allowed states. It is not a k-ID adapter or a complete authorization engine. Browser grants and user opt-ins have separate schemas.
- Assessments reject duplicate/foreign evidence IDs, invalid states and oversized text. Reply validation binds its assessment ID and cited evidence. No page/provider text is rendered as HTML.
- Node-only conditional exports separate both rubric schema and answer data from public questions. W09 will add server-owned reveal state, grading, uniqueness and transactions. There is no grading/award endpoint now.
- Voice schemas carry owned references, context versions, stages, cancellation and deadlines. W08 must implement the real checks, capture and cleanup; schema validation does not implement a voice pipeline.
- Provider adapters remain null/not configured. No vendor SDK, endpoint or k-ID permission key is invented. Fixture explanations are not live AI.
- No incident history, browsing content, audio, transcript, DOB, progress or coaching memory is persisted. UI preferences are in memory too. The reset command therefore deletes nothing; the UI resets its selections. SQLite progress remains W09 work.

## Verification evidence

Verified with Node 22.20.0 / npm 11.6.1. These checks establish foundation behavior, not full product acceptance.

| Check | Result / boundary |
| --- | --- |
| Root install and clean `npm ci` | Passed from the root lockfile; six workspaces. An initial offline-only attempt lacked cached tarballs and required a normal registry install |
| `npm run typecheck` | Passed across workspaces/test sources |
| `npm test` | 15 passed: strict inputs, six fixtures × three contexts, evidence/owner consistency, fail-closed decisions, forbidden browser rubric import, URL parsing, voice schema invariants, HTTP boundaries and inert fixture pages |
| `npm run build` | Passed for shared packages, API, companion and extension |
| `npm run check:bundles` | Passed; no rubric fields, backend entrypoint markers or provider credential variable names in browser assets |
| `npm run dev` | Both documented URLs, API proxy and fixture route responded; Ctrl+C stopped children and released ports 5173/8787 |
| `npm run dev:extension` | Watch mode produced manifest/popup/worker/content; stopped afterward |
| `npm run demo:reset` | Completed without deleting unrelated state; no foundation persistence exists |
| `npm run test:smoke` | Passed: built companion → real API, contexts, P01/P16/ambiguous cases, preferences, no-credit preview, reset, mobile width and inert pages; no companion page errors |
| Actual unpacked extension smoke | Unmodified MV3 build loaded; actual worker responded, popup rendered, manual action refused a restricted extension page |
| Positive toolbar `activeTab` grant/content notice | **Not automated or manually verified in this session**; checklist below remains pending |
| Live providers, microphone, full detection and awards | Not attempted; not implemented |

Playwright 1.55.1 and its Chromium 140 test build support the available Ubuntu 20.04 host; the latest Playwright could not install a browser here. The pin is test-only and should be reassessed with a newer test host. Run `npx playwright install chromium` before smoke testing. Smoke uses isolated ports 15173/18787 and an ephemeral browser profile; it saves a temporary screenshot outside the repo and closes servers/browser afterward. Do not rebuild the extension concurrently with smoke, since the build replaces artifacts before Chromium loads them.

## Manual extension checklist — pending

Use the unmodified `apps/extension/dist` from `npm run build`, with the development companion/API running.

1. Load unpacked in Chrome Developer mode and pin Beacon. Confirm no all-site or microphone access is required at installation.
2. Visit `http://127.0.0.1:8787/fixtures/P01`, invoke the **toolbar icon**, and choose **Show current-page access**. Confirm a dismissible notice with actual hostname `127.0.0.1`, explicitly stating no analysis/recording ran.
3. Dismiss and invoke again; there must be one notice rather than duplicate cards. The shell collects no text fields and sends no network request.
4. Repeat on P16 and an ordinary accessible HTTP(S) page. Expect an access confirmation only, without a threat verdict.
5. Navigate to a different origin. Access requires a new toolbar invocation; no automatic content script or unsolicited warning should appear.
6. Invoke on `chrome://extensions` or another restricted page; expect unavailable access and no injection. **Open companion demo** should open the configured local app.
7. Use keyboard focus/dismissal and reload after rebuilding. Inspect Chrome's extension details for runtime errors.

The automated test opens the popup URL directly; that supplies no toolbar gesture and does not prove a positive activeTab grant. That part is deliberately not counted as passed. See Chrome's [activeTab documentation](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab) and Playwright's [extension testing guidance](https://playwright.dev/docs/chrome-extensions).

## Next clean handoff

- **Role A / W02:** authenticated owners and server sessions; actual k-ID permission/jurisdiction/correction mapping and test provenance. Public demo contexts cannot substitute for this boundary.
- **Role B / W03/W04:** enabled-origin registration, visible extraction/exclusions, actual local rules/deduplication, and full onboarding/settings/screens. Fixture outcomes and access notices are scaffolding.
- **Role C / W06 onward:** confirm SDK/auth/model/retention contracts before Gemini, then validated Inworld output and Modulate redaction. Preserve captions, consent and backend checks.

Before W08 collects a real recording, reconcile CONTRIBUTING's real-player-voice prohibition with the spec's presenter-microphone proposal and record the agreed interpretation. No voice was collected here; future synthetic audio belongs only in `assets/synthetic`. Do not weaken policy to make a test pass.

No deployment, provider verification, merge or extension publication is included. Foundation review does not mark subsequent tasks complete.
