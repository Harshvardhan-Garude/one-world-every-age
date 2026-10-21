# Beacon — One world, every age

A browser safety companion that helps children, teenagers, adults, and older adults recognize online risks, understand the evidence, and practice safer decisions.

The planned experience is **notice a supported concern → explain the evidence and safe next step → offer an optional clue challenge → continue through permitted text or voice**. Basic local protection and preset lessons remain useful when cloud or voice features are unavailable.

## Project status

**Planning stage.** This change adds the functional specification and implementation handoff. The repository contains contribution rules and a secret-scanning workflow; it does not yet contain a committed application, backend, loadable extension, or verified provider integration. No application test results or live integration results are claimed.

## Start here

| Document | Purpose |
| --- | --- |
| [Functional specification v1.1](INTERNET_SAFETY_COMPANION_FUNCTIONAL_SPEC_FINAL.md) | Product requirements, all 18 scenario families, permission boundaries, badge rules, acceptance criteria, and demo script |
| [Work plan](docs/WORK_PLAN.md) | Claimable tasks, three ownership roles, dependencies, milestones, and completion evidence |
| [Architecture and handoffs](docs/ARCHITECTURE.md) | Proposed repository layout, shared contracts, provider boundaries, and integration conventions |
| [Contributing](CONTRIBUTING.md) | Branches, approvals, squash merges, secrets, and synthetic-data rules |

The work plan organizes the specification without replacing or reducing it. Architecture details below are proposals for the bootstrap task. This documentation PR does not begin product implementation.

## Planned first iteration

- Chrome desktop Manifest V3 extension: checks on explicitly enabled sites, manual selected-text/link analysis, concise warnings, and site pause controls.
- Responsive companion app: onboarding, evidence details, optional learning challenges, badges, accessibility/privacy settings, and a labeled demo center.
- Backend: authenticated sessions, feature-permission enforcement, provider adapters, and replay-safe learning progress.
- Local rules for supported scam patterns, plus deterministic fixtures for the full scenario catalog. No alert is a guarantee that a page is safe.
- Optional voice coaching: **Modulate redaction → Gemini reasoning → Inworld speech**, with captions, explicit recording controls, cancellation, and text fallback.
- k-ID test-session integration when supported access is available, with provenance visible and server enforcement of applicable decisions.

The first end-to-end target is the synthetic game-reward concern **P01** alongside legitimate comparison **P16**, through the actual unpacked extension. All ages and the complete scenario catalog remain iteration-1 requirements. See the work plan for the remaining sequence.

## Get the repository ready

For contributions through Harsh's fork:

```bash
git clone https://github.com/Harshvardhan-Garude/one-world-every-age.git
cd one-world-every-age
git remote add upstream https://github.com/jbisaccia-9/one-world-every-age.git
git config core.hooksPath .githooks
```

After this documentation PR merges, synchronize with upstream before starting implementation:

```bash
git fetch upstream
git switch -c feat/workspace-bootstrap upstream/main
```

If already working in a checkout, reuse it and inspect `git status` before changing branches. Claim a task in the [work plan](docs/WORK_PLAN.md), and substitute its branch name for the example above. Push your feature branch to your fork and open a PR against `jbisaccia-9/one-world-every-age:main`.

When configuring the future backend, copy `.env.example` to `.env` only if `.env` does not already exist. Fill values locally through the team's approved private channel. Never commit secrets or put partner credentials in browser code.

**Application setup is pending W00.** There is no supported install/dev/build/test command or extension build directory in the committed repository yet. The bootstrap PR must add and verify those commands, then replace this paragraph with the exact setup and Chrome loading steps. Untracked starter files in an individual checkout are not a team-wide implementation contract.

## Provider configuration and verification

These are repository implementation statuses, not an audit of anyone's vendor account or local credentials.

| Provider | Planned responsibility | Current implementation status |
| --- | --- | --- |
| k-ID | Age/jurisdiction/consent decisions mapped to application capabilities | Not configured in application; no adapter or live test committed |
| Gemini | Evidence-grounded explanations and conversational reasoning | Not configured in application; no adapter or live test committed |
| Inworld | Speech output of validated text | Not configured in application; no adapter or live test committed |
| Modulate | Voice transcription with sensitive-information redaction | Not configured in application; no adapter or live test committed |
| FastSpring | Possible later relevant sandbox entitlement flow | Deferred |

The existing `.env.example` lists server-side placeholders for k-ID, Inworld, Modulate, and FastSpring. Provider owners must confirm the actual SDK/configuration and add any required variable names, including Gemini configuration, without values. The template alone does not establish a working integration. Use the spec's statuses: **live verified**, **implemented but unverified**, **mock**, **not configured**, or **deferred**. Record k-ID sandbox/test provenance separately from production identity assurance.

## Boundaries to preserve

Local demo personas cannot authorize production features. Unknown, pending, expired, or denied permissions do not authorize dependent operations. Browser site/microphone grants, server permissions, and explicit user intent are separate checks.

Use synthetic people and controlled fixtures. Keep raw audio, raw browsing content, transcripts, and unnecessary date-of-birth data out of durable storage and logs by default. Voice begins only after an explicit Talk action; Stop/revocation must invalidate pending replies. Badges come from curated, independent learning attempts, never from model agreement or repeated reports.

Mobile/native monitoring, general image forensics, universal third-party blocking, external guardian notifications, emergency dispatch, payments, and public extension distribution are outside this first build. No deployment is part of this planning change.

## Verification and review

The [work plan](docs/WORK_PLAN.md#acceptance-coverage) maps every acceptance group to its owners. Future completion reports must distinguish unit/integration tests, actual extension browser checks, and live provider tests. A companion-app test does not prove that an extension works; mock playback does not prove a live voice turn.

Follow [CONTRIBUTING.md](CONTRIBUTING.md): feature branches, one teammate approval and a green `guard` check, then squash merge. The repository owner controls any permitted override. Claims of readiness must include reproducible evidence and outstanding limitations.
