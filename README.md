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
