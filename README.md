# OzoneLayer

OzoneLayer is a hackathon prototype that teaches people how to respond to suspicious online messages. A Chrome extension and web companion show fictional scenarios for different ages. A child gets a deceptive offer in a game, and an older adult gets a suspicious toll notice. Each lesson explains the warning signs and gives the user a next step.

Built by Joseph Bisaccia, Harshvardhan Garude, and Angela Liu at the Google and k-ID Build for Everyone Hackathon in San Francisco in October 2026. OzoneLayer was a finalist in the Games track.

- [Official recording](https://k-id.com/events/build-for-everyone-san-francisco-2026) (OzoneLayer starts at 43:46)
- [Runnable demo branch](https://github.com/Harshvardhan-Garude/one-world-every-age/tree/feat/ozone-demo)
- [Demo runbook](https://github.com/Harshvardhan-Garude/one-world-every-age/blob/feat/ozone-demo/docs/DEMO.md)

## Run the local demo

Use Node.js 22.12 or newer within Node 22 LTS and npm 10 or 11.

```bash
git clone --branch feat/ozone-demo --single-branch https://github.com/Harshvardhan-Garude/one-world-every-age.git
cd one-world-every-age
npm ci
npm run dev
```

Open [the companion](http://127.0.0.1:5173) and choose a fictional scenario. The offline demo runs on local examples with text coaching and a simulated family budget.

To try the Chrome extension, run `npm run build`, then load `apps/extension/dist` as an unpacked extension. The [runbook](https://github.com/Harshvardhan-Garude/one-world-every-age/blob/feat/ozone-demo/docs/DEMO.md#build-and-load-the-extension) lists the supported fixture pages and Chrome permissions.

To run the automated tests on the demo branch, use `npm test`.

## Windows verification

With Node 22.20.0 and npm 10.9.3, dependency installation, typecheck, all builds,
browser-bundle inspection, and the Chromium/unpacked-extension smoke test passed.
The unit test run passed 107 of 109 tests; two SQLite tests failed during cleanup
because Windows still held their database files open. Close the stores before
removing those temporary files to make the test suite portable.

The optional private k-ID SDK archive is absent from a fresh clone. npm may warn
about that archive while the offline install still succeeds. Live voice, browser
claim redemption, parent-approved payments, and Chrome's actual toolbar/host
permission grants remain separate from the automated fixture checks.
