# J.A.R.V.I.S.

A cinematic silver-on-black circular HUD with text chat, system and cloud voices, optional realtime ElevenLabs conversation, and read-only iCloud email briefings. The reference Python project at https://github.com/gia-guar/JARVIS-ChatGPT is separate and is not installed or executed here.

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
2. On the deployed site, enter the private password in Settings and click **Set up live voice**. This creates a private ElevenLabs agent using the selected voice, a conversational LLM, read-only mail and interface client tools, normal turn detection, interruptible speech, a 300-second session limit, one concurrent session, two sessions/day, and disabled bursting. Setup does not make calls, send mail, or purchase a plan. Failures are surfaced; no alternative agent is silently used.
3. The app displays a **non-secret agent ID**. Add it in Render as `ELEVENLABS_AGENT_ID`, save/redeploy, then refresh. This retains the same agent across sleeping/restarting servers and preserves provider-side limits. Without it, the agent is cached only in the running process and setup after a restart could create another agent.
4. Enable **Live conversation mode**, then click **Enable voice**. A visible countdown shows the five-minute session limit. Say **give me an email briefing** or ask an open-ended question; speak to interrupt the response. **Disable voice** ends the session. The SDK manages microphone/audio teardown; late connections after cancellation are also ended. Closing the page ends local media. No automatic reconnect loop starts additional paid sessions.

The private `/api/live/session` endpoint issues a short-lived ElevenLabs conversation token for the server-configured agent; it never sends a provider API key to the browser. Startup is capped at four attempts/hour per process. Provider-set five-minute/two-per-day limits apply to the created agent; these are usage limits, not a guarantee of staying below $25/month. Realtime speech and its LLM are billed by ElevenLabs separately from OpenAI text/TTS usage; check included minutes, usage billing, and extra-credit settings. The selected voice and realtime mode cannot be considered working until a live session is validated with the user's provider account.

Live transcripts and email follow-ups stay in tab memory and are excluded from localStorage; explicit export can still save them. Audio, transcripts and tool results are processed by ElevenLabs and its configured model provider. Agent setup requests no voice recording, one-day retention, and deletion of audio/transcript/PII; this is not a guarantee of zero provider retention. Review actual account privacy settings. No voice recording is stored by this app. The voice/model picker and speed slider affect standard mode; the live agent's voice/delivery is configured when created. Change those in the ElevenLabs Agents dashboard if an existing saved agent needs updating.

## Email briefings

Set `ICLOUD_EMAIL` (full iCloud Mail address) and `ICLOUD_APP_PASSWORD` (Apple app-specific password) privately in Render. Apple requires two-factor authentication and enabled iCloud Mail. Revoke that app-specific password in Apple Account settings to disconnect. The backend must reach `imap.mail.me.com:993`; HTTP connectivity does not establish IMAP connectivity.

Click **Email briefing** or say **give me an email briefing**, **check my mail**, or **review my emails**. The read-only IMAP connection fetches up to five latest INBOX messages without marking them read. It sends sender, subject, date, unread state, and up to 3,500 plain-text characters per small message to the selected AI path. Bodies over 100 KB are omitted; HTML-only bodies and attachments are not opened. The briefing covers important messages, stated deadlines, and suggested next steps; it is not a full mailbox search. Follow-up questions can discuss the returned review.

In live mode the model calls `read_recent_emails`; the client permits the tool only after a recent explicit user email request, and the server rechecks the private password and limits mailbox reads. Email data is untrusted source material, never instructions. There are no send/delete, calendar, phone, browsing, or computer-control tools. Interface tools only navigate or pause/resume decoration. The app does not schedule background briefings. Email reviews and all subsequent messages in that tab are private and not saved to localStorage; clearing the conversation resets that behavior. Explicit export and speaking aloud can disclose the review. Credentials should never be pasted into ordinary conversation.

## Interface and validation

Rotating SVG rings pulse by interface state, not measured audio amplitude. Settings, chat and history open as drawers. **Core**, Close, the backdrop, or Escape returns to the ring view. Fullscreen uses the browser API. Decorative motion can be paused and respects reduced-motion preferences. **Stop reply** silences current output; it does not cancel an already-running text request. In live mode normal spoken interruption is handled by ElevenLabs; the button silences output until the next turn.

Automated tests use simulated provider services and cover authenticated text/audio/session endpoints, provider selection, limits, read-only IMAP, MIME bounds, failures without secret leakage, speech command detection, interruption callbacks, explicit mail authorization, connection cancellation and media cleanup. Browser checks cover the actual SDK bundle loading and simulated setup/start/stop/timer, private transcripts, voice selection, and mobile settings. No paid provider session or live mailbox access was performed by the agent; microphone quality, actual latency, interruption behavior, external model availability, credentials and provider costs still require validation in the user's deployment.

## Troubleshooting voice and mail

Settings now shows whether **Live mode** or **Standard mode** is selected; the main button says **Start live voice** only for the realtime path. Choosing an ElevenLabs voice in the standard voice dropdown alone does not enable realtime mode. End live voice before choosing a microphone. **Choose microphone** requests local browser access, lists the available devices, and immediately stops the temporary probe tracks. The selected device is used for the next live session. Headphones and one active voice tab can help distinguish speaker echo from a lost connection.

**Voice connection diagnostics** lists only bounded connection/state events and a numeric disconnect code where available—no session token, credentials, transcript, or email content. **Copy diagnostics** copies that text. Known recoverable client-tool warnings no longer close the live session. Fatal failures still end local media; safe messages distinguish blocked microphone, provider usage limits, voice access, browser audio blocking, and connection failure. This does not establish the root cause of any particular user's report without runtime evidence.

Use **Test iCloud connection** in Settings to isolate mail from the voice agent. This authenticated, rate-limited check reads the bounded recent-inbox sample and returns only success and a count; it sends no mail content to a model. Apple authentication rejection, connection timeout, network failure, and TLS errors receive separate safe error messages. No raw Apple responses or passwords are returned. If the connection check succeeds but the live agent still refuses email, inspect voice diagnostics for tool activity and verify that the saved agent is the one created by this app.


## Response latency

Live agents use normal turn eagerness rather than patient turn detection and cap conversational output at 220 tokens. Before the next live session, a saved agent's existing settings are read and the turn eagerness/reply cap are updated once per running process, preserving its prompt, tools, chosen voice and privacy/call limits. Already-fast settings require no write. Tuning has short timeouts; a denied settings update does not block a usable session, and diagnostics disclose whether quick settings were applied or the original settings retained. No speculative generation or extra paid tier is enabled.

Email bodies are retrieved in one bounded IMAP UID FETCH after the metadata query (two fetch commands for five small messages, rather than six). Limits, read-only behavior and omission of large messages are unchanged. Standard browser recognition restarts after 150 ms instead of 400 ms; realtime mode avoids that restart loop entirely. The core screen labels LIVE CONVERSATION versus STANDARD VOICE so the slower path is apparent. Live diagnostics record approximate time from a recognized request to first reply audio, and mail-fetch duration, without recording speech or email text. These changes reduce avoidable waits but do not establish a measured improvement on the user's provider connection. Free Render cold starts, provider processing, and network latency still apply.
