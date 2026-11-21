// Solmar Bay — gta6-01 entry point (Node 22, standard library only).
//
// What this program does, in three steps:
//   1. Copies the game — the static files in game/ beside this file — into the
//      output directory, so the grader can serve game/index.html in a browser.
//   2. Copies screenshots/ the same way (3 or 4 real renders of the game).
//   3. Writes dossier.json through the vendored make.fun library, which reads
//      the copied files and summarises the game for the judge: the source outline,
//      the screenshots and the file counts. The dossier is the judge's briefing.
//
// The game itself is plain static files: game/index.html plus its scripts and
// one vendored library (game/vendor/three.min.js). It makes no network requests
// and needs no build step, so it runs identically every time it is copied.
//
// Run it locally with MAKEFUN_OUTPUT_DIR set, for example:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// In the grader's container the output directory is /output by default.
// Serve the game locally with `node serve.ts`, then open http://localhost:8080.

import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The game folder must be there; without it there is nothing to judge.
if (!existsSync(join(repoRoot, 'game', 'index.html'))) {
  throw new Error('game/index.html is missing — the entry cannot be built');
}

// Screenshots are the judge's first look at the game, so refuse to hand in an
// entry that forgot them.
const shotsDir = join(repoRoot, 'screenshots');
if (!existsSync(shotsDir) || readdirSync(shotsDir).filter((f) => /\.(png|jpe?g)$/i.test(f)).length < 3) {
  throw new Error('screenshots/ needs at least 3 PNG/JPEG renders of the game');
}

mkdirSync(outDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outDir, 'game'), { recursive: true });
cpSync(shotsDir, join(outDir, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json). text_max_bytes shapes the dossier
// text; the rest refuse an entry the scorer would refuse anyway: more than 4
// screenshots or one over 256 KiB, more than 993 files in game/ or 48 MiB of game
// files in all, or a path under game/ over 1000 bytes.
writeFileSync(
  join(outDir, 'dossier.json'),
  buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

console.log('Built Solmar Bay into ' + outDir);
