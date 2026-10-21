# Ozone Layer — One world, every age

*Working title. Earlier drafts and some internal identifiers use "Beacon" (see [Naming](#naming)).*

Ozone Layer is a browser safety companion for learning to notice online risks, understand evidence and choose a safer next step. All ages can explore the current synthetic examples. Parent-approved purchases are planned; basic protection will remain free.

This local integration combines W02, the uncommitted teaching/provider increment, and the recorded open team PRs #5/#6. It is **not team main**. The companion now runs authenticated P01/P16 scripted explanation → curated quiz → server-checked feedback, without mastery awards or vendor calls. The extension remains a manual-access shell. Real k-ID authorization, the protected Gemini route, voice and purchases remain incomplete. See [the exact integration audit and next tasks](docs/INTEGRATION.md).

## Team and roles

| Person | Role | Owns |
| --- | --- | --- |
| Harsh | A — Backend and permissions | Sessions, k-ID integration and capability enforcement, purchase policy, k-ID and FastSpring webhooks, persistence |
| Joseph | B — Extension and experience | Chrome extension, warnings, companion screens, parent dashboard and consent/purchase screens, accessibility, stretch learning game |
| Angela | Coordinator, plus C — AI and voice (with Joseph) | Merges, demo flow and submission; Gemini, Inworld and Modulate adapters |

Task ownership is in the [work plan](docs/WORK_PLAN.md).

## Run locally

Use Node **22.12 or newer within Node 22 LTS** and npm **10 or 11**. Verified with Node 22.20.0 and npm 11.6.1; `.nvmrc` selects the verified Node release. There is one root lockfile.

```bash
npm ci
npm run dev
```

- Companion: **http://127.0.0.1:5173**
- API health: **http://127.0.0.1:8787/health**
- Controlled examples: **http://127.0.0.1:8787/fixtures/P01** and **http://127.0.0.1:8787/fixtures/P16**
- Stop with Ctrl+C; the runner closes both children. Occupied ports fail instead of silently changing.

No provider keys or `.env` file are needed. Optional settings are listed in `.env.example`; copy it only when `.env` does not already exist. Never overwrite or commit an existing `.env`. Runtime scripts load root `.env` server-side; provider configuration is not imported by browser code.

## Build and load the extension shell

```bash
npm run build
# Optional: watch and rebuild extension artifacts
npm run dev:extension
```

1. Open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select **`apps/extension/dist`** in this checkout.
2. Keep `npm run dev` running and open a controlled local fixture in Chrome.
3. Invoke Ozone Layer from its toolbar icon. Choose **Show current-page access**. On an accessible HTTP(S) tab, a dismissible notice confirms temporary access and says no content analysis ran.
4. **Open companion demo** opens the configured companion. Restricted browser/extension pages must show unavailable access.
5. After rebuilding, reload the extension in Chrome. See the [foundation runbook](docs/FOUNDATION.md) for the complete manual checklist and automated coverage.

Installation requests `activeTab`, `scripting` and `storage`, with no required host access or automatic content scripts. Optional host declarations reserve later per-origin monitoring; the shell does not request or use them. It does not scan, send page content to the API, or record sound.

`BEACON_COMPANION_ORIGIN` defaults to `http://127.0.0.1:5173` and is baked into the popup at build time; rebuild after changing it. The popup's **Local connection** section shows its real extension origin. For a future API connection, add that exact origin to the local server's comma-separated `BEACON_EXTENSION_ORIGINS` and restart the API. This nonsecret CORS allowlist grants neither authentication nor feature permission. The shell currently makes no extension-to-API requests.

## Commands

| Command | Behavior |
| --- | --- |
| `npm ci` | Install six workspaces from the single root lockfile |
| `npm run dev` | Start companion and API with coordinated shutdown |
| `npm run dev:extension` | Watch/rebuild `apps/extension/dist`; reload in Chrome afterward |
| `npm run build` | Build shared packages, API, companion and extension |
| `npm run typecheck` | Check all workspaces and test sources |
| `npm test` | Schema, fixture, boundary and HTTP integration tests |
| `npm run check:bundles` | Inspect built browser assets for server/rubric/configuration markers |
| `npm run test:smoke` | Test the built companion/API and actual unpacked extension in Chromium |
| `npm run demo:reset` | Reset only foundation-owned persisted demo state; currently none exists |

Prepare browser testing with:

```bash
npm run build
npx playwright install chromium
npm run test:smoke
```

Smoke uses isolated ports **15173/18787** and closes its servers/browser afterward. Playwright **1.55.1** is pinned for the available Ubuntu 20.04 test host; this is a development-tool constraint, not a product browser requirement. The visible **Reset demo** button restores in-memory persona, fixture, preferences and preview selections. No history, progress or recordings are persisted.

## What works and what remains

The companion fetches validated demo assessments for synthetic child, teen and adult contexts. Larger text and plain language are available to everyone, including older adults. P01 credential/reward and P16 educational/legitimate comparisons have baseline, safe and ambiguous variants, deterministic evidence IDs, explanations and safe actions. These are pre-authored fixture outcomes, not live scanning. The other 16 scenario families remain unimplemented.

The companion checks practice answers on the server and returns teaching feedback, without awarding mastery credit. The original public preview API remains available. Rubric schemas and answers use separate Node-only exports and are absent from browser bundles. The public API exposes health, catalog, inert fixture pages and `POST /api/demo/assessments`; it rejects extra owner/grant/correctness fields and production modes. No production authorization endpoint exists. The extension is a popup/worker/manual-access shell, with no threat verdict or background monitoring.

Illustrative `*.example` addresses are labeled metadata; actual fixture URLs are local. No sample domain mapping is configured. No supported indicators never means verified safe.

## Authenticated backend

Public demo routes are preserved. `POST /api/onboarding/session` creates a bounded, short-lived Ozone Layer session; private capabilities, context, refresh, logout and fixture-assessment routes require its bearer credential. Authenticated local-demo P01/P16 assessments now support scripted explanation → short quiz → server-checked teaching feedback, without mastery credit or vendor calls. Gemini/Inworld provider-test routes use the W02 authorization boundary and return explicit **not configured** errors when settings are missing. Production mode is rejected. See [the backend API examples and frontend contract handoff](docs/BACKEND.md) for a complete runnable offline request sequence, runtime provider status, exact configuration and live-verification gaps. The companion is wired to these private offline routes. It keeps application credentials only in memory and logs out on lesson/persona changes; stale sessions show a reload action. Provider-test UI remains separate.

## Provider and privacy status

| Provider | Assigned responsibility | Current state |
| --- | --- | --- |
| k-ID | W02 Test Mode sessions and permission refresh | CDK adapter implemented but unverified; runtime **not configured** without credentials/workflow |
| Gemini | Evidence-based reasoning in W06 | Standalone live connectivity verified with `gemini-3.5-flash-lite`; protected application route still unverified pending genuine k-ID authorization; **not configured** without key/model |
| Inworld | Validated speech output in W07 | Non-streaming MP3 adapter and protected route implemented; simulated HTTP tests only; **not configured** without key/model/voice |
| Modulate | Speech transcription/redaction in W08 | **Not configured**; interface only |
| FastSpring | Parent's saved payment method and test-mode charges for approved purchases in W14 | **Not configured**; two behaviors to confirm with FastSpring ([spec 13.1](INTERNET_SAFETY_COMPANION_FUNCTIONAL_SPEC_FINAL.md#131-parent-approved-purchases)) |

Automated provider tests use injected simulated HTTP responses. A separate live Gemini diagnostic with fixed fictional text verified authentication/model access and structured response parsing; see [the exact results and remaining application blockers](docs/BACKEND.md#live-gemini-connectivity-diagnostic--2026-10-21). No k-ID approval was fabricated and no real-person recording was made. Pre-authored explanations remain labeled fixtures, not live AI. Product permissions and retention configuration still require verification; environment placeholders do not establish access.

The future chain is Modulate redaction → Gemini reasoning → Inworld speech. Browser grants, backend eligibility, cloud consent and explicit Talk intent remain separate. Voice data rule (reconciled in CONTRIBUTING): a consenting **adult** presenter's live voice turn may be processed in memory as the spec describes, but no recording is ever committed, stored or logged, and no child's or real player's voice is used. This foundation collects no audio.

## k-ID age gate (companion)

The default companion opens directly into labelled offline teaching. The unverified k-ID widget is optional and cannot authorize backend operations. The team's original widget is preserved in [`integrations/kid/widget.tsx`](integrations/kid/widget.tsx); [`apps/companion/src/kid.tsx`](apps/companion/src/kid.tsx) provides an explicit opt-in entry.

`npm ci`, typecheck and the default build work without the private SDK, publishable key or support email. Optional widget setup and its unverified status are documented in [the integration handoff](docs/INTEGRATION.md#optional-k-id-widget). No SDK stub or simulated vendor approval is used.

`POST /api/kid/claim` still accepts a bounded token and reports `redeemed: false`; no guessed redemption endpoint is called. `POST /api/kid/session` now requires an application bearer credential and `{contextVersion}` and refreshes only its server-bound W02 session. It rejects caller-supplied vendor session IDs. Widget permission visibility remains informational; W02 enforces protected operations.

**Web, iOS and Android**

- The companion is a responsive web app; the combined build passed desktop and 390px Chromium checks. Real iOS Safari, Android Chrome and WebView devices remain unverified. It respects the notch and home-bar safe areas, uses 16px inputs so iOS doesn't zoom on focus, has 44px touch targets, uses dynamic viewport height, and ships a web app manifest so it can be added to the home screen.
- Chrome extensions don't run on Chrome for iOS or Android, so on phones the companion is the experience. A Safari Web Extension for iOS is later scope.
- k-ID's API supports native iOS (App Attest) and Android (Key Attestation) clients, but this SDK is the web client. Native apps would need k-ID's native integration and are out of this build's scope.

## Planned next features

- **Parent-approved purchases (W14, [spec 13.1](INTERNET_SAFETY_COMPANION_FUNCTIONAL_SPEC_FINAL.md#131-parent-approved-purchases)).** The adult admin consents through k-ID, saves a card in FastSpring's hosted checkout, and picks a rule: off, approve each request, a monthly limit, and/or notify after each purchase. Approvals use k-ID's purchase-approval flow; charges go to the saved card through FastSpring in test mode. Only Ozone Layer's own catalog can be purchased: FastSpring cannot pay other companies' games or stores, and card data never touches our code.
- **Stretch: learning game (W15).** Only once the full flow works end to end: a small offline game, in the style of Chrome's dinosaur game, that explains why content was blocked and how to use the tool more safely. Always optional.

## Naming

The product name is **Ozone Layer** (working title); the repository and team name stay `one-world-every-age`. User-visible text uses Ozone Layer. These internal identifiers keep the earlier "Beacon" name on purpose, because renaming them would change the lockfile and every import mid-event: the `@beacon/*` workspace packages, the `BEACON_COMPANION_ORIGIN` and `BEACON_EXTENSION_ORIGINS` settings, and internal message/element IDs. Renaming them is a safe follow-up after the event.

## Team handoff

| Document | Use |
| --- | --- |
| [Functional specification v1.2](INTERNET_SAFETY_COMPANION_FUNCTIONAL_SPEC_FINAL.md) | Full product contract, including parent-approved purchases (13.1) and the stretch learning game (8.4) |
| [Work plan](docs/WORK_PLAN.md) | W02–W15 ownership, dependencies and acceptance mapping |
| [Architecture](docs/ARCHITECTURE.md) | Component responsibilities and integration boundaries |
| [Backend handoff](docs/BACKEND.md) | W02 routes, bearer credentials, capability mapping, test evidence and live blockers |
| [Foundation runbook](docs/FOUNDATION.md) | Exact API/contracts, validation evidence and manual Chrome checklist |
| [Contributing](CONTRIBUTING.md) | Hooks, approvals, squash merge and synthetic-data policy |

W00/W01 merged in PR #4. This integration preserves the team's Harsh/Joseph/Angela ownership assignments and adds a [shared-file handoff and ranked plan](docs/INTEGRATION.md). Harsh and Joseph must agree the widget claim → owned application-session binding before enabling it. Angela/Joseph can continue the provider/voice work against the existing authorization wrapper. A browser capability check or successful standalone Gemini diagnostic does not authorize the application.

Use feature branches, enable `.githooks`, obtain one teammate approval and green `guard` CI, then squash merge under CONTRIBUTING. No deployment, extension publication or direct push to team `main` is included.
