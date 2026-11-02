# J.A.R.V.I.S. interface

A responsive, animated command center inspired by the supplied circular HUD image, with a sage monochrome palette, chat console, quick protocols, local history/export, browser voice input, and optional spoken replies.

## Run

Requires Node.js 20 or later. No package installation is needed.

```sh
npm start
```

The server listens on port 3000 (override with `PORT`). `npm run dev` enables server reload. `npm test` runs HTTP smoke tests.

## Current behavior

Chat uses labeled, deterministic demo responses. No AI model, external tools, calendar, news, or hardware telemetry is connected. Messages are saved in browser localStorage and can be cleared or exported from the interface. Microphone input uses the browser's speech recognition service, requires permission and a secure context (HTTPS or localhost), and may transmit audio to the browser vendor. Voice transcription fills the input for review before sending.

The reference https://github.com/gia-guar/JARVIS-ChatGPT is a separate Python voice assistant with legacy Python/CUDA and API dependencies. This interface does not install or execute it. Connecting an AI backend requires a separate server-side integration; keep credentials out of browser code.

Google Fonts is optional; system fonts are used if unavailable. Animations respect reduced-motion preferences and can be paused in Settings.

## Hands-free voice mode

Open the HTTPS site in Chrome or Edge, click **Enable voice**, and allow the microphone. Recognized speech is submitted automatically while enabled. Listening pauses during spoken replies, then resumes. Say **stop listening** or click **Disable voice** to stop. The browser tab must remain open; this is not a background Windows assistant or an offline wake-word detector.

Say **open settings**, **open conversations**, **open protocols**, **go home**, **pause animation**, **resume animation**, **export conversation**, **clear conversation**, **what time is it**, **daily briefing**, **system diagnostics**, **mute voice**, or **unmute voice**. Clearing removes the local chat immediately. In Settings choose an available system voice, adjust its speed, and preview it. Voice availability depends on Windows/browser configuration; no paid provider or custom trained voice model is included. Recognition may require network access to the browser vendor. General chat remains a demo without an AI backend.

Voice lifecycle/navigation, automatic submission, spoken replies, microphone-denial handling, and mobile layout were checked in Chromium with simulated speech APIs. Real microphone recognition and audio playback require a check on the user's device.

## Real AI on Render

Render hosts the entire interface and its private AI API. The GitHub Pages copy remains a demo. Create a Render Web Service from this repository (Node runtime), use `node --check server.js` as the build command, `npm start` as the start command, and `/health` as the health-check path. `render.yaml` also provides a Blueprint configuration.

Set `OPENAI_API_KEY` only in Render's secret environment settings. Set `JARVIS_ACCESS_TOKEN` there to a unique, randomly generated password of at least 16 characters. Never commit or share either value. Open your Render URL and enter that private access password in the app's Settings; the app holds it only in tab memory and sends it over same-origin HTTPS. Do not enter an OpenAI API key in the website. Browser extensions or anyone who knows the private password may access your paid endpoint; this is a single-owner prototype, not a multi-user authentication system.

The default model is `gpt-4.1-mini` (override with `OPENAI_MODEL`). Requests send up to ten recent conversation messages to OpenAI, request no server-side storage (`store: false`), and cap responses at 500 output tokens. This does not imply zero provider retention. A default 30-request hourly limit and one concurrent request apply per server process. Configure `JARVIS_HOURLY_LIMIT` to lower usage. The counter resets when the service restarts; it is not a monthly spending cap. Keep provider auto-reload disabled and monitor prepaid credits. No live paid API request was made during development; API behavior was verified with simulated provider responses.

Render's free service can sleep when idle; a free deployment does not provide a continuously running background assistant. Check Render's current pricing before choosing a paid always-on plan, and keep hosting plus API/calling costs within your budget. No email, calendar, calling, scheduled background jobs, or custom voice model is connected yet.

## iCloud Mail review (read-only)

In Render Environment add `ICLOUD_EMAIL` (your full iCloud Mail address) and `ICLOUD_APP_PASSWORD` (an Apple app-specific password, never your Apple Account password). Enter both directly in Render, never in chat or the public repository. Change the Render build command to `npm ci && node --check server.js` so pinned dependencies are installed, then save/redeploy. The Blueprint also uses this command. Apple requires two-factor authentication and an enabled iCloud Mail account. Revoke the app-specific password in Apple Account settings to disconnect access.

On your Render website, enter the private JARVIS access password in Settings, then click **Review my emails**, or say **check my email**. This explicitly retrieves the latest five INBOX messages using verified TLS to `imap.mail.me.com:993`, a read-only mailbox, and no message-writing commands. A deployment must allow outbound IMAP connections on port 993; HTTP connectivity alone does not prove mail access. Connection errors report failure and do not invent an email review.

Sender, subject, date, unread status, and up to 3,500 plain-text characters per small message are sent to the AI provider with your review request. Messages larger than 100 KB have their bodies omitted. HTML-only mail bodies and attachments are not opened. The app marks all replies and follow-up messages private after an email review, excludes them from localStorage, and retains them only in tab memory. Clearing the conversation resets this private session. Explicit conversation export can still download the review, and speech can read it aloud. Model requests use `store: false`, which is not a guarantee of zero provider retention. Do not paste credentials into chat; ordinary conversation text is also sent to the AI provider.

This is an on-demand review of five recent messages, not full-mail search or background monitoring. It cannot send/delete mail or mark it read. Email is handled as untrusted source material, not as commands. There are no action tools available to the model. Automated tests cover read-only access, message limits, MIME parsing, timeouts, authentication, error handling, and browser storage behavior with simulated services. Live iCloud access still needs validation using credentials in the user's Render deployment.

## Natural British AI voice

On the configured Render site, enter your private JARVIS password in Settings, choose **Natural British assistant · API credits** from the Voice selector, and click **Preview voice**. The selection is remembered on this browser. Enable voice or spoken responses to hear replies. This is an AI-generated, British-style assistant voice, not an actor recording or a trained custom voice clone. Free computer voices remain available.

The private `/api/speech` endpoint uses OpenAI `gpt-4o-mini-tts` with the built-in `fable` voice and delivery instructions. It uses the existing server-side API key; a restricted key must allow audio speech requests. Text for speech is sent to OpenAI and MP3 audio is returned with `Cache-Control: no-store`. No audio files are stored by the app. Playback uses a temporary in-memory object URL that is revoked on the next reply, mute, disable, or page exit. Muting or disabling voice cancels pending audio fetches and playback. Listening pauses while generating/playing speech, then resumes. If autoplay is blocked, click **Play voice reply** in the voice bar. Failures show details in Settings rather than silently switching voices.

Natural voice consumes API credits in addition to text chat. Each request is capped at 1,500 characters (long replies are abbreviated in audio), with one active generation and 30 attempts per hour per process by default. Lower `JARVIS_TTS_HOURLY_LIMIT` in Render to reduce usage. Limits reset on process restart and are not monthly spending caps; keep prepaid auto-reload off and monitor billing. Free Render hosting and separate reply/audio generation can add latency; this is not a realtime interruptible voice session. No paid audio request was made during development. Tests used simulated provider audio and browser playback; listen to Preview voice on the live deployment to verify model access and sound quality.

## Cinematic interface

The home screen is a black fullscreen-style stage with concentric silver SVG rings, counter-rotating arcs, radial ticks, and subtle idle breathing. Listening, thinking, voice generation, and speaking each have distinct motion states. These are interface-state animations, not a measured audio waveform. Use the small **Chat**, **History**, **Protocols**, and **Settings** controls to open drawers; **Core**, **Close**, the backdrop, or Escape returns to the ring view. The fullscreen control uses the browser's fullscreen API. The **Stop reply** button stops generated audio or computer speech; it does not provide spoken interruption or cancel an AI text request already underway. Spoken interruption still requires a future voice upgrade.

The animation checkbox and “pause animation” voice command pause all decorative motion. System reduced-motion preferences disable animation. Layout, drawer access, typing, voice-state transitions, stop reply, and mobile sizing were checked in Chromium using simulated AI/speech services.
