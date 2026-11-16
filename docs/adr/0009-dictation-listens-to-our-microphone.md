# 0009 · Dictation listens to a microphone the app opens

Date: 2026-11-16 · Status: Accepted

## Context

Dictation uses the browser's Web Speech API. By default the recogniser opens a microphone on its own, and the page cannot choose which. In Comet the recogniser kept listening to an audio interface that came with a dock: unplugged, dictation started but never heard a word, and the app showed nothing. A page cannot fix the browser's remembered device, and the system settings were already right.

Chromium 135+ on desktop accepts a `MediaStreamTrack` in `SpeechRecognition.start(track)`. We checked it on 2026-11-16 in Chrome 157 and Comet 156 with fake devices: given a track, the recogniser transcribes that track and not the default input. Passing a track that has already ended does not throw; the session just hangs, and a track that ends mid-session leaves the recogniser silent until it is stopped. Safari, Firefox and phones either ignore the argument or have no recogniser at all.

## Decision

- On desktop Chromium 135+ (`navigator.userAgentData`: a Chromium brand ≥ 135, not mobile, macOS, Windows or Linux), `lib/voice/speech.ts` opens the microphone with `getUserMedia` and passes its track to the recogniser. Everywhere else the recogniser keeps its own microphone, unchanged.
- "System default" requests Chromium's `default` device id, which follows the operating system even when the browser remembers another device. Without the alias, a plain request already means the system default.
- Settings → Voice lists the microphones (`enumerateDevices`, refreshed on `devicechange`), stores the pick in `localStorage` (`pw-mic`: id and name; ids are per browser and per site) and tests it with a live level meter. Browsers that can't use the pick get a note instead of a selector.
- A picked microphone that isn't connected falls back to the system default with a notice. If its id changed, the device is found again by name.
- Our code owns the microphone: it is released when dictation ends, is cancelled or after a 3 s grace period following stop. When the track ends (the device was unplugged), the session aborts, nothing is sent, and the words heard so far go back to the text field.
- Every error has a message the user can act on: no speech, no microphone, microphone busy or unplugged, permission denied, speech service unreachable or refused.

## Consequences

- Dictation follows the system microphone, or the one picked in Settings, on desktop Chrome, Edge, Comet and Arc, whatever the browser remembers.
- The level meter shows whether sound arrives, which tells a microphone problem from a speech-service problem.
- The `NativeSpeechBridge` contract is unchanged: native shells keep choosing their own microphone.
- Browsers without a speech service (Brave, Firefox, embedded browsers) still need server-side transcription. The opened track is the natural input for it once a transcription provider is active.
