# Beacon — One world, every age

A browser safety companion for learning to notice online risks, understand evidence, and choose a safer next step. Children, teenagers, adults and older adults belong in the experience from the start.

**W00/W01 foundation merged in PR #4; W02 backend code in review.** This branch provides a runnable companion, public demo API, loadable Chrome MV3 shell, shared runtime schemas and P01/P16 fixtures. W02 adds authenticated local sessions and owned fixture references; production mode, automatic detection, live-verified providers, voice, grading and awards remain unavailable. All demo capabilities are unknown; no demo selection authorizes production use.

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
3. Invoke Beacon from its toolbar icon. Choose **Show current-page access**. On an accessible HTTP(S) tab, a dismissible notice confirms temporary access and says no content analysis ran.
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

Question/choice previews do not grade or award credit. Rubric schemas and answers use separate Node-only exports and are absent from browser bundles. The public API exposes health, catalog, inert fixture pages and `POST /api/demo/assessments`; it rejects extra owner/grant/correctness fields and production modes. No production authorization endpoint exists. The extension is a popup/worker/manual-access shell, with no threat verdict or background monitoring.

Illustrative `*.example` addresses are labeled metadata; actual fixture URLs are local. No sample domain mapping is configured. No supported indicators never means verified safe.

## Authenticated backend

Public demo routes are preserved. `POST /api/onboarding/session` creates a bounded, short-lived Beacon session; private capabilities, context, refresh, logout and fixture-assessment routes require its bearer credential. Production mode is rejected. Missing k-ID configuration leaves provider-test onboarding unavailable and protected operations disabled. See [the backend API examples](docs/BACKEND.md) for exact requests and the Role C authorization wrapper. No UI onboarding rewrite is included.

## Provider and privacy status

| Provider | Assigned responsibility | Current state |
| --- | --- | --- |
| k-ID | W02 Test Mode sessions and permission refresh | CDK adapter implemented but unverified; runtime **not configured** without credentials/workflow |
| Gemini | Evidence-based reasoning in W06 | **Not configured**; interface only |
| Inworld | Validated speech output in W07 | **Not configured**; interface only |
| Modulate | Speech transcription/redaction in W08 | **Not configured**; interface only |
| FastSpring | Possible later relevant sandbox flow | **Deferred** |

No live provider calls, mock production approvals or real-person recordings were made. Pre-authored explanations are labeled fixtures, not live AI. SDK/auth/model/retention configuration must be confirmed by the owning task; environment placeholders do not establish access.

The future chain is Modulate redaction → Gemini reasoning → Inworld speech. Browser grants, backend eligibility, cloud consent and explicit Talk intent remain separate. Before W08 collects any real recording, the team must reconcile CONTRIBUTING's voice-data prohibition with the spec's presenter-microphone proposal. This foundation collects no audio.

## Team handoff

| Document | Use |
| --- | --- |
| [Functional specification v1.1](INTERNET_SAFETY_COMPANION_FUNCTIONAL_SPEC_FINAL.md) | Unchanged full product contract |
| [Work plan](docs/WORK_PLAN.md) | W02–W13 ownership, dependencies and acceptance mapping |
| [Architecture](docs/ARCHITECTURE.md) | Component responsibilities and integration boundaries |
| [Backend handoff](docs/BACKEND.md) | W02 routes, bearer credentials, capability mapping, test evidence and live blockers |
| [Foundation runbook](docs/FOUNDATION.md) | Exact API/contracts, validation evidence and manual Chrome checklist |
| [Contributing](CONTRIBUTING.md) | Hooks, approvals, squash merge and synthetic-data policy |

W00/W01 merged in PR #4. W02 provides the backend boundary described in [BACKEND.md](docs/BACKEND.md); real k-ID verification remains blocked on access/configuration. Role A must confirm and validate the event product flow; Role B can take W03/W04 detection and companion flows; Role C can review provider contracts before W06. Teammates claim roles explicitly. Use W02's authenticated service wrapper for protected provider execution; a client-side capability check is not authorization.

Use feature branches, enable `.githooks`, obtain one teammate approval and green `guard` CI, then squash merge under CONTRIBUTING. No deployment, extension publication or direct push to team `main` is included.
