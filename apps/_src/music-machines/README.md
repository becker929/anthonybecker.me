# Music machines: Onset, Cadence, Pairing

Source for the three apps served at `/apps/onset/`, `/apps/cadence/` and
`/apps/pairing/`. This folder is not deployed (see `.assetsignore`); the
site serves only the built `index.html` and `app.js` in each app folder.

```
npm install
npm test          # rhythm, chord, voicing, MIDI and history-file logic
npm run build     # rewrites ../../{onset,cadence,pairing}/
```

- `src/rhythm.ts`: rhythm IDs, next-rhythm rules, emphasis maps, MIDI and zip writers.
- `src/chords.ts`: chord IDs, vocabularies, next-progression rules, voicing.
- `src/sets.ts`: the history list each machine writes into its history zip, which Pairing reads.
- `src/machine.ts`: the shared store and lookahead scheduler.
- `src/App.tsx`, `ChordApp.tsx`, `ComboApp.tsx`: the three pages.
- `src/themes/`: one stylesheet per machine.
