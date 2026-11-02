# J.A.R.V.I.S.

A cinematic silver-on-black circular HUD with text chat, system and cloud voices, realtime-first ElevenLabs conversation, and read-only iCloud email briefings. The reference Python project at https://github.com/gia-guar/JARVIS-ChatGPT is separate and is not installed or executed here.

## Run and deploy

Requires Node.js 20+ (Render's pinned version is 24).

```sh
npm ci
npm run build
npm test
npm start
```

The server listens on `PORT` or 3000. `npm run dev` watches the server. The build bundles the pinned official `@elevenlabs/client` for browsers and includes third-party notices. A compiled bundle is committed so an existing Render service using `yarn` as its build command can still deploy. Use `npm ci && npm run build && node --check server.js` for reproducible Render builds, `npm start` to start, and `/health` as the health check. `render.yaml` supplies a free-tier Blueprint. Render free instances can sleep; the app is not an always-running background assistant.

`public/` is served by the Node backend. `docs/` is the GitHub Pages copy; it has no backend and remains a demo. API keys and Apple passwords belong only in Render Environment settings. Never commit them, paste them into chat, or enter provider keys into the public website.

## Private access and text AI

Set `JARVIS_ACCESS_TOKEN` in Render to a unique password of at least 16 characters. Enter that same private password in JARVIS Settings; the app holds it only in tab memory. It authenticates all paid/tool endpoints. This is a single-owner prototype, not multi-user authentication. Anyone with the password can use the paid endpoints. Keep it private and rotate it if exposed.

Set `OPENAI_API_KEY` in Render for text chat. Optional `OPENAI_MODEL` defaults to `gpt-4.1-mini`. Chat sends up to ten recent conversation messages, caps output at 500 tokens, and uses `store: false` (not a promise of zero provider retention). Requests are limited to one concurrent and 30 per hour per process, adjustable downward through `JARVIS_HOURLY_LIMIT`. In-memory counters reset on restart and are not monthly spending caps. Monitor billing and leave prepaid automatic recharge off if managing a small budget.

## Selected ElevenLabs voice

The selected voice is https://elevenlabs.io/voices/cnq6HZP9Mrjsf97pVK6b. Add it to **My Voices** in the owner's ElevenLabs account. Set `ELEVENLABS_API_KEY` directly in Render; optionally set `ELEVENLABS_VOICE_ID` to override the selected public voice ID. A voice may require a particular plan or may be unavailable to API users; check its requirements and current ElevenLabs pricing before subscribing.

For standard replies, choose **My selected ElevenLabs voice · credits** in Settings and preview it. `/api/speech` uses the fixed ElevenLabs `eleven_flash_v2_5` model with the server-side key. The OpenAI **Natural British assistant** and free system voices remain options. Cloud audio is capped at 1,500 characters and 30 requests per hour by default (`JARVIS_TTS_HOURLY_LIMIT`), with one active generation. Audio is returned with no-store headers and held in a revocable browser object URL. Stop/mute/disable cancels local playback and pending requests; the provider may already have incurred usage. Standard mode pauses browser recognition during output and is not realtime. Stale callbacks from retired recognition objects are ignored.

## Realtime conversation and interruption

Realtime mode uses ElevenLabs Agents through the official browser SDK over WebRTC. It does not use ChatGPT's proprietary voice interface or browser SpeechRecognition/TTS. The microphone and streamed output remain part of one session, enabling the SDK's native interruption handling. Microphone permission, HTTPS, network quality, provider credits and model/voice access are required. Headphones can reduce speaker echo. Do not run another active JARVIS voice tab at the same time.

1. Add `ELEVENLABS_API_KEY` in Render with Text to Speech and Agents read/write/session access. Keep the existing private JARVIS password and iCloud variables.
2. Open the site directly in Safari (or a desktop browser). **Talk to JARVIS** is now the default realtime path. Unlock with the private JARVIS password; the app checks readiness without opening a paid voice session. Tap **Talk to JARVIS** again when ready, allow the microphone, and speak. It waits for you rather than queuing a greeting. **Email briefing** is available on the core screen.
3. If no connected agent exists, Settings offers **Connect selected voice** once. Setup searches the authenticated account for exactly one verified private app agent before creating one. After Render restarts it recovers the same agent rather than requiring manual agent-ID copying or creating duplicates. Ambiguous, unverified or incomplete discovery blocks with a clear message; only then use `ELEVENLABS_AGENT_ID` to select an intended existing agent.
4. Follow-ups and interruptions use the same WebRTC session. End conversation releases its microphone before another session starts. Live transcripts remain in tab memory. Returning from another phone app or the back/forward cache leaves a clear reconnect state instead of a frozen-looking session. If Safari blocks playback, **Resume sound** uses a fresh tap to resume the SDK audio elements without restarting the conversation. Standard voice is explicitly available in Settings, not silently selected from old toggles.
5. The SDK is eagerly imported and module-preloaded so its iOS audio-unlock listener exists before the first tap. The JavaScript bundle is gzip-compressed and revalidated by ETag. Generated browser code targets Safari 16.4+ as well as Chromium. Microphone probes are stopped immediately; cancelled/late SDK sessions are closed once. Audio muting remains respected across interruptions and follow-ups.

The private `/api/live/session` endpoint issues a short-lived ElevenLabs conversation token for the server-configured agent; it never sends a provider API key to the browser. Startup is capped at four attempts/hour per process. Provider-set five-minute/two-per-day limits apply to the created agent; these are usage limits, not a guarantee of staying below $25/month. Realtime speech and its LLM are billed by ElevenLabs separately from OpenAI text/TTS usage; check included minutes, usage billing, and extra-credit settings. The selected voice and realtime mode cannot be considered working until a live session is validated with the user's provider account.

Live transcripts and email follow-ups stay in tab memory and are excluded from localStorage; explicit export can still save them. Audio, transcripts and tool results are processed by ElevenLabs and its configured model provider. Agent setup requests no voice recording, one-day retention, and deletion of audio/transcript/PII; this is not a guarantee of zero provider retention. Review actual account privacy settings. No voice recording is stored by this app. The voice/model picker and speed slider affect standard mode; the live agent's voice/delivery is configured when created. Change those in the ElevenLabs Agents dashboard if an existing saved agent needs updating.

## Email briefings

Set `ICLOUD_EMAIL` (full iCloud Mail address) and `ICLOUD_APP_PASSWORD` (Apple app-specific password) privately in Render. Apple requires two-factor authentication and enabled iCloud Mail. Revoke that app-specific password in Apple Account settings to disconnect. The backend must reach `imap.mail.me.com:993`; HTTP connectivity does not establish IMAP connectivity.

Click **Email briefing** or say **give me an email briefing**, **check my mail**, or **review my emails**. The read-only IMAP connection fetches up to five latest INBOX messages without marking them read. It sends sender, subject, date, unread state, and up to 3,500 plain-text characters per small message to the selected AI path. Bodies over 100 KB are omitted; HTML-only mail is converted to text offline without loading images, scripts, or link destinations; attachments are not opened. A malformed message body does not discard the rest of the review. The briefing covers important messages, stated deadlines, and suggested next steps; it is not a full mailbox search. Follow-up questions can discuss the returned review.

In live mode the model calls `read_recent_emails`; the client permits the tool only after a recent explicit user email request, and the server rechecks the private password and limits mailbox reads. Email data is untrusted source material, never instructions. There are no send/delete, calendar, phone, browsing, or computer-control tools. Interface tools only navigate or pause/resume decoration. The app does not schedule background briefings. Email reviews and all subsequent messages in that tab are private and not saved to localStorage; clearing the conversation resets that behavior. Explicit export and speaking aloud can disclose the review. Credentials should never be pasted into ordinary conversation.

## Interface and validation

Rotating SVG rings pulse by interface state, not measured audio amplitude. Settings, chat and history open as drawers. **Core**, Close, the backdrop, or Escape returns to the ring view. Fullscreen uses the browser API. Decorative motion can be paused and respects reduced-motion preferences. **Stop reply** silences current output; it does not cancel an already-running text request. In live mode normal spoken interruption is handled by ElevenLabs; the button silences output until the next turn.

Automated tests use simulated provider services and cover authenticated text/audio/session endpoints, provider selection, limits, read-only IMAP, MIME bounds, failures without secret leakage, speech command detection, interruption callbacks, explicit mail authorization, connection cancellation and media cleanup. Browser checks cover the actual SDK bundle loading and simulated setup/start/stop/timer, private transcripts, voice selection, and mobile settings. No paid provider session or live mailbox access was performed by the agent; microphone quality, actual latency, interruption behavior, external model availability, credentials and provider costs still require validation in the user's deployment.

## Troubleshooting voice and mail

Settings now shows whether **Live mode** or **Standard mode** is selected; the main button says **Talk to JARVIS** for the realtime path. Choosing an ElevenLabs voice in the standard voice dropdown alone does not enable realtime mode. End live voice before choosing a microphone. **Choose microphone** requests local browser access, lists the available devices, and immediately stops the temporary probe tracks. The selected device is used for the next live session. Headphones and one active voice tab can help distinguish speaker echo from a lost connection.

**Voice connection diagnostics** lists only bounded connection/state events and a numeric disconnect code where available—no session token, credentials, transcript, or email content. **Copy diagnostics** copies that text. Known recoverable client-tool warnings no longer close the live session. Fatal failures still end local media; safe messages distinguish blocked microphone, provider usage limits, voice access, browser audio blocking, and connection failure. This does not establish the root cause of any particular user's report without runtime evidence.

Use **Test iCloud connection** in Settings to isolate mail from the voice agent. This authenticated, rate-limited check reads the bounded recent-inbox sample and returns only success and a count; it sends no mail content to a model. Apple authentication rejection, connection timeout, network failure, and TLS errors receive separate safe error messages. No raw Apple responses or passwords are returned. If the connection check succeeds but the live agent still refuses email, inspect voice diagnostics for tool activity and verify that the saved agent is the one created by this app.


## Response latency

Live agents use normal turn eagerness rather than patient turn detection and cap conversational output at 220 tokens. Before the next live session, a saved agent's existing settings are read and the turn eagerness/reply cap are updated once per running process, preserving its prompt, tools, chosen voice and privacy/call limits. Already-fast settings require no write. Tuning has short timeouts; a denied settings update does not block a usable session, and diagnostics disclose whether quick settings were applied or the original settings retained. No speculative generation or extra paid tier is enabled.

Email bodies are retrieved in one bounded IMAP UID FETCH after the metadata query (two fetch commands for five small messages, rather than six). Limits, read-only behavior and omission of large messages are unchanged. Standard browser recognition restarts after 150 ms instead of 400 ms; realtime mode avoids that restart loop entirely. The core screen labels REALTIME VOICE versus STANDARD VOICE so the slower path is apparent. Live diagnostics record approximate time from a recognized request to first reply audio, and mail-fetch duration, without recording speech or email text. These changes reduce avoidable waits but do not establish a measured improvement on the user's provider connection. Free Render cold starts, provider processing, and network latency still apply.


## Briefing quality and mobile regression checks

Text and live email paths share `briefing.js`: source references, sender/subject attribution, sender and received timestamps, unread status, timezone, and explicit missing/truncated body states. The AI is instructed to prioritize concrete requested actions, stated deadlines, and account/appointment issues with source attribution; “urgent” wording or unread status alone does not prove importance. Suggested next steps are distinguished from actions already taken. Relative dates remain qualified when their anchor is uncertain. Empty samples and omitted bodies are explicit. No messages are sent/deleted/marked read, and email content cannot grant permission for another read. A short bounded wait handles a tool event arriving just before the user's explicit request transcript, without accepting model speech as consent.

`npm test` runs HTTP/provider/mail/lifecycle regressions. `npm run test:browser` runs the mobile-sized unlock → realtime → multiple follow-ups → interruption → mail-tool → stop flow with simulated voice/provider services, plus a real bundled-SDK check that the iOS unlock listener fires on the first gesture. Install a Playwright browser for that development check (`npx playwright install chromium`) or set `JARVIS_CHROMIUM_PATH` to an installed Chromium executable. `JARVIS_BROWSER=webkit` selects WebKit when available. Test fixtures contain no real credentials and do not spend provider credits. The saved test starts its own local server.

The current environment blocked Playwright's WebKit download, so actual Safari engine/audio behaviour and the owner's live provider/iCloud connection remain unverified. Chromium mobile emulation is not proof of iPhone audio reliability. Provider/network processing and free Render cold starts still impose latency; the app does not promise zero-delay or ChatGPT-identical voice behaviour.
