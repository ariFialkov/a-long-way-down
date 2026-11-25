// Shared constants: physics, layout, the object catalogue and the palette.
export const CFG = {
  G: 24, // gravity, units/s^2 (1 unit ~ 1 metre, character is ~1.8 tall)
  BODY_R: 0.45, // collision radius of the torso (the planned path is the torso centre)
  SECTION_H: 26,
  XLIM: 5.6, // planned hit points stay within +-XLIM
  PLAY_HW: 6.5,
  Z0: 1.5, // depth plane the character falls in (wall face is z = 0)
  START_Y: 1.245, // torso centre height while standing
  OPEN_HW: 1.7,
  FLOOR_T: 0.8,
  WORLD_HW: 46,
};

// mode: peg (bounce off a round thing), plat (bounce off a small flat thing, smashing whatever rests on it),
// pass (crash straight through), stop (ends the fall). w = share of the win, p = pick weight.
export const KINDS = {
  rock: { biome: 'cliff', mode: 'peg', r: [0.55, 0.8], w: 1, p: 5 },
  boulder: { biome: 'cliff', mode: 'peg', r: [0.95, 1.2], w: 1.5, p: 2 },
  log: { biome: 'cliff', mode: 'peg', r: [0.36, 0.42], w: 1, p: 3 },
  lamp: { biome: 'building', mode: 'peg', r: [0.42, 0.42], w: 1.2, p: 4 },
  sign: { biome: 'building', mode: 'peg', r: [0.65, 0.8], w: 1.2, p: 4 },
  dish: { biome: 'building', mode: 'peg', r: [0.6, 0.7], w: 1, p: 2 },
  ac: { biome: 'building', mode: 'peg', r: [0.62, 0.62], w: 1, p: 2 },
  flagpole: { biome: 'building', mode: 'peg', r: [0.24, 0.24], w: 1, p: 2 },

  ledge: { biome: 'cliff', mode: 'plat', toppers: { none: 2, flowers: 3, hut: 2, goat: 2 }, p: 1 },
  minibalc: { biome: 'building', mode: 'plat', toppers: { none: 2, pots: 3, pigeons: 2.5 }, p: 1 },

  bridge: { biome: 'cliff', mode: 'pass', hw: [2.5, 3.1], w: 6, p: 3 },
  bunting: { biome: 'cliff', mode: 'pass', hw: [2.2, 3], w: 3, p: 3 },
  bird: { biome: 'cliff', mode: 'pass', mover: true, w: 5, p: 2 },
  clothesline: { biome: 'building', mode: 'pass', hw: [2.2, 3], w: 3.5, p: 3 },
  awning: { biome: 'building', mode: 'pass', hw: [1.4, 1.7], w: 3, p: 3 },
  sugar: { biome: 'building', mode: 'pass', mover: true, w: 8, p: 2.5 },

  bigledge: { biome: 'cliff', mode: 'stop' },
  balcony: { biome: 'building', mode: 'stop' },
};
export const TOPPER_W = { none: 1.5, flowers: 3, pots: 3, pigeons: 3.5, hut: 5, goat: 6 };

export const PAL = {
  skyTop: 0x38a8ff, skyBot: 0xc9f0ff,
  strata: [0xf2b48a, 0xe79a72, 0xf7c9a0, 0xdc8763, 0xf0a981, 0xcf7a5c, 0xf9d5ae],
  rock: [0xb7a696, 0xa89585, 0xc7b8a8], rockDark: 0x8f7d70,
  grass: [0x8fdc5c, 0x7acb4e, 0xa6e86e], moss: [0x7fcf6a, 0x6cbd5c, 0x9ade7a],
  wood: [0xb9814f, 0xa26c3f, 0xcf9a63], woodDark: 0x7c4f2c,
  crack: 0xa55f48, cave: 0x4a2c33,
  facades: [0xffd3a3, 0xffb3b3, 0xc6f5bd, 0xa5ecf7, 0xc9bfff, 0xfff3a8, 0xa9caff, 0xffc2e2],
  trim: 0xffffff, slab: 0xe9e4f0, rail: 0x4b4f6b, metal: 0x9aa3b5, metalDark: 0x5c6478,
  roofTile: 0xe8785a, street: 0xb9bfcc,
  flowers: [0xff5d8f, 0xffd23f, 0xff8c42, 0xb48cff, 0xffffff, 0xff6b6b, 0x5ad1ff],
  cloth: [0xff6b6b, 0x4ecdc4, 0xffe66d, 0x5a9bff, 0xff9ff3, 0xffffff, 0xff9f43, 0x7bed9f],
  skin: [0xffd2b0, 0xf1b48c, 0xc98b62, 0x8d5a3b], hair: [0x3b2b25, 0x7a4a2b, 0xe0b352, 0x1f1f29, 0xc7c7d1, 0xd9534f],
  room: [0xffe6b8, 0xffd0c2, 0xd4f1ff, 0xe6dcff, 0xdcf7d4, 0xfff0d9],
  gold: 0xffc93c,
};
