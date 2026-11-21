// Solmar Bay: an original open-world crime game. All names, places, characters and the
// story are invented for this game; nothing comes from any commercial game.
// config.js — the one place for every number, colour, name and layout the other files read.

window.SB = window.SB || {};

// --- The city ---------------------------------------------------------------
SB.CITY = {
  name: 'Solmar Bay',
  // One block is 44 units of buildings and sidewalk; roads between blocks are 14 wide.
  block: 44,
  road: 14,
  blocks: 9, // 9 x 9 blocks, so the drivable city is about 520 units across
  ground: 640,
};

SB.PALETTE = {
  sky: 0x87bfe8,
  sun: 0xfff2cf,
  ground: 0x3d3a35,
  sidewalk: 0x8f8a80,
  road: 0x2e2d2b,
  roadLine: 0xd8d2c4,
  // Sun-soaked building faces: warm pastels and washed-out modern glass.
  buildings: [0xe8b48a, 0xd98f7a, 0xc9d6c5, 0x9fb8c8, 0xe6d3a3, 0xb7a6c9, 0x8fb8a8, 0xd9a0a0],
  glass: [0x7fb2d9, 0x6fa8c9, 0x9cc4d8],
  roofs: [0x6b5d4f, 0x7a6a58, 0x5d6b6b],
  palmTrunk: 0x8a6b4a,
  palmLeaf: 0x3f8f4f,
  lamp: 0x2b2b2b,
};

// --- People -----------------------------------------------------------------
SB.PEOPLE = {
  // The player: Jace Marlowe, a wheelman fresh out of a two-year stretch, back in Solmar Bay.
  playerName: 'Jace Marlowe',
  // The fixer who hands out the jobs.
  fixerName: 'Rico Delano',
  // The crew that wants the harbour route for itself.
  rivalCrew: 'The Vulture Crew',
  // Pedestrian first names, mixed up at random; none is a real person's name on purpose.
  names: ['Ana', 'Bo', 'Cleo', 'Dante', 'Elena', 'Felix', 'Gia', 'Hugo', 'Ines', 'Kai',
    'Lena', 'Marco', 'Nia', 'Omar', 'Pia', 'Quinn', 'Rosa', 'Silas', 'Tara', 'Umar'],
  // Shirt colours for the crowd.
  shirts: [0xc94f4f, 0x4f7ec9, 0x53a05a, 0xd9a03f, 0x8a5fc9, 0xd97fb0, 0x3fbfbf, 0xe8e8e8],
  walkSpeed: 2.2,
  runSpeed: 5.2,
};

// --- Cars -------------------------------------------------------------------
SB.CARS = {
  // Original makes and models, invented for Solmar Bay.
  models: [
    { name: 'Civic Dart', make: 'Kestrel', top: 26, accel: 14, grip: 2.6, colour: 0xc23b2e },
    { name: 'Sunrunner', make: 'Marlin', top: 22, accel: 11, grip: 2.4, colour: 0x2e7fc2 },
    { name: 'Harbor Taxi', make: 'Marlin', top: 20, accel: 10, grip: 2.2, colour: 0xe8b820 },
    { name: 'Vulture GT', make: 'Falco', top: 34, accel: 19, grip: 3.1, colour: 0x222226 },
    { name: 'Bay Van', make: 'Kestrel', top: 18, accel: 8, grip: 2.0, colour: 0x8a8f96 },
    { name: 'Palm Cruiser', make: 'Falco', top: 24, accel: 12, grip: 2.5, colour: 0x7ec8b8 },
  ],
  trafficCount: 12,
  policeModel: { name: 'Interceptor', make: 'Solmar PD', top: 32, accel: 18, grip: 3.0, colour: 0x1c2f4a },
};

// --- Gameplay ---------------------------------------------------------------
SB.GAME = {
  playerWalk: 6,
  playerSprint: 10,
  playerHealth: 100,
  pistolDamage: 34,
  pistolMag: 12,
  punchDamage: 12,
  punchRange: 2.2,
  shootRange: 90,
  stealTime: 1.2, // seconds holding E beside a car to take it
  wantedMax: 5,
  wantedDecaySeconds: 18,
  bustedSeconds: 2.0, // a cop standing this close this long ends the run
  saveKey: 'solmar-bay-save-v1',
  startCash: 150,
};

// --- Missions: the story of Jace Marlowe's first week back ------------------
// Each mission is a chain of objectives. A marker is { x, z, label } in world units.
SB.MISSIONS = [
  {
    id: 'fresh-wheels',
    title: 'Fresh Wheels',
    brief: 'Rico Delano has a job for you, but you need wheels first. Meet him on Marlin Row, then take any car on the street and bring it to the garage on Palm Court.',
    steps: [
      { type: 'goto', x: 87, z: -29, label: 'Meet Rico on Marlin Row', radius: 6 },
      { type: 'steal', label: 'Steal a car (hold E beside one)', radius: 0 },
      { type: 'drive', x: -87, z: 87, label: 'Drive the car to the garage on Palm Court', radius: 8 },
    ],
    reward: 300,
  },
  {
    id: 'the-pickup',
    title: 'The Pickup',
    brief: 'A package is waiting at the docks. Collect it and run it to the drop on Coral Avenue. The Vulture Crew tipped off the police, so expect heat on the way back.',
    steps: [
      { type: 'goto', x: 145, z: 261, label: 'Collect the package at the docks', radius: 6 },
      { type: 'drive', x: -145, z: -145, label: 'Deliver the package to Coral Avenue (police are coming)', radius: 8, wanted: 2 },
    ],
    reward: 600,
  },
  {
    id: 'harbor-heat',
    title: 'Harbor Heat',
    brief: 'The Vultures set you up and the whole Solmar PD is on you. Lose the heat and get to the hideout on Gull Street. Do not get busted.',
    steps: [
      { type: 'escape', x: 29, z: 145, label: 'Lose the police, then reach the hideout on Gull Street', radius: 8, wanted: 4 },
    ],
    reward: 1000,
  },
];

// Side jobs after the story: pick up a fare and drop them off for cash.
SB.SIDE_JOB_REWARD = 150;

// --- Controls (shown on the start screen and the help panel) ----------------
SB.CONTROLS = [
  ['W A S D', 'Move / drive'],
  ['Mouse', 'Look around (drag)'],
  ['Shift', 'Sprint'],
  ['E', 'Enter or steal a car (hold)'],
  ['Left click', 'Shoot (on foot)'],
  ['F', 'Punch'],
  ['R', 'Reload'],
  ['Space', 'Handbrake (in a car)'],
  ['P / Esc', 'Pause'],
  ['M', 'Mission details'],
];
