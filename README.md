# Solmar Bay — an open-world crime game

![gta6-01](https://make.fun/badge/gta6-01.svg)
![rank](https://make.fun/badge/gta6-01/luckilyonetoo-spec/gta6-01/rank.svg)
![reward](https://make.fun/badge/gta6-01/luckilyonetoo-spec/gta6-01/reward.svg)

An entry for the [gta6-01 competition on make.fun](https://make.fun/bounty/gta6-01):
build the best open-world crime game, entirely original — its own city, its own
characters, its own story.

**Solmar Bay** is a 3D open world in the browser. You are Jace Marlowe, a driver
fresh out of a bad deal, trying to earn your way back in a sunny coastal city
while a rival crew, the Vulture Crew, leans on the neighbourhood. Take jobs from
Rico Delano, the fixer who knows every street, earn cash, stay out of trouble —
or don't, and see how long you last with the Solmar Bay police on your tail.

## What is in the game

- **A city you can cross on foot and by car** — 9×9 blocks of streets, a park
  with a fountain, palms along the beach road and the sea to the south.
- **Traffic and pedestrians** — cars drive the lanes and turn at crossings,
  people walk the pavements and scatter when trouble starts.
- **Cars you can steal** — walk up to any car, hold E, and drive off. The owner
  runs, and the police notice.
- **A wanted level and police who chase you** — five stars, from a patrol car
  tailing you to roadblocks of interceptors and foot cops who will arrest you.
- **Missions with a story** — three story jobs from Rico (Fresh Wheels, The
  Pickup, Harbor Heat) plus side jobs once the story is done, with cash rewards
  and a save after every completed mission.
- **Combat** — a pistol with a 12-round magazine, and your fists when you are
  close. Vulture thugs shoot back.
- **A HUD with a minimap** — health, cash, the clock, wanted stars, an objective
  compass, speed and ammo, plus a live minimap of the city, traffic, police and
  your objective.
- **A start screen and a save** — new game or continue, pause, and your progress
  (cash, missions, position, health) saved in the browser.
- **Procedural sound and music** — engine hums, sirens, gunshots and an
  A-minor chord-pad loop, all synthesised with WebAudio. No audio files.

## How to play

Open `game/index.html` in a desktop browser (Chrome works best). No install, no
network — everything is local, including the vendored three.js library.

| Key | What it does |
| --- | --- |
| W A S D | Move / drive (W accelerate, S brake and reverse, A D steer) |
| Shift | Sprint on foot |
| Mouse (drag) | Look around |
| E (hold) | Steal a car / get out |
| Space | Handbrake while driving |
| Left click | Shoot |
| F | Punch |
| R | Reload |
| M | Toggle the music |
| Esc / P | Pause |
| H | Help |

Follow the gold beacon to your objective; the compass arrow at the top of the
screen points the same way. Crime raises your wanted level; lay low and it
fades. Getting arrested or knocked out costs you cash and puts you back at the
hospital, alive and poorer.

## How it is built

The game is plain static files under `game/` — `index.html` and a dozen small
JavaScript files, plus `game/vendor/three.min.js` (three.js r149, vendored so the
game runs offline). The city, its textures and its sounds are all generated at
runtime, so the whole game ships without image or audio files. Static geometry
is merged per material, and the game turns its shadows off by itself on a
machine that cannot hold 12 fps (`?fx=low` in the URL forces the low setting).

`main.ts` at the repository root is the entry point the competition uses: it
copies `game/` and `screenshots/` into the output directory and writes
`dossier.json`, the summary the judge reads. Run it locally with:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Serve the game locally with `node serve.ts`, then open http://localhost:8080.
