# SYNTH80

A TypeScript browser groovebox built with Vite and the Web Audio API. Includes a 16-step drum sequencer, editable minor-scale bass patterns, FM/chiptune/modular voices, swing, live keyboard, waveform display, browser-local session storage and WAV recording.

## Run

```sh
npm install
npm run dev
```

Open `http://127.0.0.1:5173/synth/`. `npm run build` type-checks and builds to `dist`.

Enable audio once before playing. A continuous noise signal at roughly −90 dBFS bypasses the instrument master and remains active when transport is stopped, preventing audio devices from sleeping. **Audio on · off** closes the audio context and releases the device. Browser autoplay policy requires the initial user gesture. Background tabs can throttle the sequencer timer.

Click drum pads to toggle steps; click track names to mute. Click a bass step to choose a note or rest; right-click clears it. The Z X C V B N M keys play C D E F G A B, with S D G H J for sharps and comma for the next C. With a pattern step selected, typing a note sets that step; Backspace or Delete turns it into a rest; Space toggles transport. Generate creates a new drum/bass pattern in the selected minor key. Save/Load uses this browser's local storage. Export records one pass with a release tail and downloads a PCM WAV; keep the tab active while recording.

Sounds are synthesized in real time, with no samples or Yamaha software. The FM voice is inspired by classic FM bass, not a hardware emulation. No backend, accounts or API keys are required.

## Mobile, tracks and voice input

Deployed at https://jcnossen.nl/synth/ using the saved PuTTY `contabo` session (the trusted hostname for this server), PSCP for upload and Plink for remote deployment. Vite uses `/synth/` as its asset base. `deploy-nginx.conf` scopes hosting to this path. The initial deployment script saves the previous nginx virtual host configuration outside `sites-enabled` before adding its include.

Use **Add synth track** for independent patterns and synth patches. Select a track before editing, generating or capturing notes; mute it with **Mute track**. **Add drum track** adds the chosen instrument, including clap, rim, open hat and percussion. Sessions retain added tracks.

The phone layout has large touch targets, horizontally scrollable drum steps with pinned track names, a four-column note editor, and a touch/slide keyboard. Enable microphone over HTTPS, then hum a steady note with headphones on. Pitch detection is entirely local; the original microphone signal is never sent to the speakers or uploaded. Choose **Bass octave** or **My sung octave**, then **Capture 1 bar** to sample the next full bar into the selected track. Silence inserts rests. Stop the microphone after capture to hear the loop. Leaving the tab stops the microphone and pauses transport; the audio keep-alive is retained until Audio off (subject to browser background suspension).

Checks: TypeScript and production build; synthetic pitch detection at 82.41?880 Hz, 44.1/48 kHz, plus silence. Physical-device microphone and touch testing still required. Pitch detection is monophonic and works best with sustained humming in a quiet room.

Each synth track has its own Track Volume slider (0-100%), affecting sequenced notes, keyboard playing and voice monitoring on that track. Master remains independent. Session Save/Load retains these levels; older sessions default synth tracks to 100%.

## Saving and sharing

**Save session** stores a versioned compact tune in local storage and, when it fits, a cookie scoped to `/synth/` with a one-year expiry, SameSite=Lax and Secure on HTTPS. Cookies larger than 3,800 characters fall back to local storage with a visible message. The app restores saved tunes on startup; shared links take priority. Existing JSON sessions are migrated when loaded.

**Share tune** serializes all drum/synth patterns, voices, patch parameters, mutes, volumes, tempo, swing and key into a URL fragment (`#tune=v1.?`). Copy the displayed link to share; clipboard failure leaves a selectable link for manual copying. The fragment is decoded locally, with version, size, structure and numeric range validation. The tune payload is not sent to the hosting server in the URL. Links load paused and do not overwrite browser saves until Save session is pressed. Microphone recordings are not included?only captured notes.

Run `node --experimental-strip-types tests/session.test.mjs` to check serialization, legacy migration, invalid links and cookie limits.
