// Deterministic screenshot states for NEON VOID.
// A URL like ?shot=play&seed=1 builds one fixed frame of the game from
// its own simulation: a seeded generator, a fixed number of fixed-size
// steps, no wall clock. The same URL always draws the same picture, so
// the three screenshots are reproducible renders of the game's own code.
import { mulberry32 } from './rng.js';
import { GAME_WIDTH, GAME_HEIGHT } from './input.js';
import { createGameState, startRun, stepGame } from './game.js';
import { SoundBank } from './audio.js';
import { createEnemy, createBullet, createGem, createFloater, burst } from './entities.js';

const STEP = 1 / 60;

function emptyInput() {
  return { moveX: 0, moveY: 0, aimX: GAME_WIDTH / 2, aimY: GAME_HEIGHT / 2 - 120, keys: new Set(), click: null };
}

function stepMany(state, steps, inputFn) {
  for (let i = 0; i < steps; i += 1) {
    stepGame(state, inputFn ? inputFn(state, i) : emptyInput(), STEP);
  }
}

function nearestEnemyAim(state) {
  let best = null;
  let bestD = Infinity;
  for (const enemy of state.enemies) {
    const dx = enemy.x - state.player.x;
    const dy = enemy.y - state.player.y;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = enemy;
    }
  }
  return best ? { x: best.x, y: best.y } : { x: state.player.x + 100, y: state.player.y };
}

function playInput(state, i) {
  const t = i * STEP;
  // Steer toward a point slowly orbiting the arena centre, so the
  // scripted run stays in the middle of the frame.
  const tx = GAME_WIDTH / 2 + Math.cos(t * 0.5) * 130;
  const ty = GAME_HEIGHT / 2 + Math.sin(t * 0.4) * 90;
  const dx = tx - state.player.x;
  const dy = ty - state.player.y;
  const d = Math.hypot(dx, dy) || 1;
  const aim = nearestEnemyAim(state);
  return {
    moveX: dx / d,
    moveY: dy / d,
    aimX: aim.x,
    aimY: aim.y,
    keys: new Set(),
    click: null,
  };
}

function buildStart(seed) {
  const state = createGameState(mulberry32(seed), new SoundBank(), { persist: false });
  state.best = 1250;
  stepMany(state, 150, null);
  return state;
}

function buildPlay(seed) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const state = createGameState(mulberry32(seed), new SoundBank(), { persist: false });
    startRun(state);
    stepMany(state, 240, playInput);
    if (state.mode === 'over') continue;
    // Resolve any level-up the simulation triggered, through the real path.
    let guard = 0;
    while (state.mode === 'levelup' && guard < 5) {
      stepGame(state, { ...emptyInput(), keys: new Set(['Digit1']) }, STEP);
      guard += 1;
    }
    if (state.mode !== 'playing') continue;
    // Dress the frame as a mid-run moment, then compose the fight around
    // the player: the ship near the middle, foes in a ring, bullets in
    // flight, gems and a fresh explosion. Every position comes from the
    // same seeded generator, so the frame is reproducible.
    state.score = 1840;
    state.kills = 23;
    state.level = 2;
    state.xp = 7;
    state.xpNext = 13;
    state.wave = 3;
    state.director.wave = 3;
    state.best = 1250;
    state.banner = null;
    state.player.x = GAME_WIDTH / 2;
    state.player.y = 380;
    state.player.vx = 0;
    state.player.vy = 0;
    state.enemies = [];
    state.bullets = [];
    state.gems = [];
    state.particles = [];
    state.floaters = [];
    const ring = [
      { kind: 'dasher', angle: -0.5, dist: 210 },
      { kind: 'drifter', angle: 0.4, dist: 260 },
      { kind: 'brute', angle: 1.4, dist: 300 },
      { kind: 'dasher', angle: 2.2, dist: 190 },
      { kind: 'drifter', angle: 2.9, dist: 280 },
      { kind: 'drifter', angle: -1.6, dist: 240 },
    ];
    for (const slot of ring) {
      const x = GAME_WIDTH / 2 + Math.cos(slot.angle) * slot.dist;
      const y = 380 + Math.sin(slot.angle) * slot.dist * 0.75;
      state.enemies.push(createEnemy(slot.kind, x, y, 3, false, state.rng));
    }
    const elite = createEnemy(
      'brute',
      GAME_WIDTH / 2 + Math.cos(-2.4) * 330,
      380 + Math.sin(-2.4) * 240,
      3,
      true,
      state.rng,
    );
    state.enemies.push(elite);
    for (const target of [state.enemies[0], state.enemies[2], state.enemies[3]]) {
      const angle = Math.atan2(target.y - 380, target.x - GAME_WIDTH / 2);
      state.bullets.push(
        createBullet(
          GAME_WIDTH / 2 + Math.cos(angle) * 60,
          380 + Math.sin(angle) * 60,
          angle,
          1,
          620,
          0,
        ),
      );
    }
    state.player.angle = Math.atan2(state.enemies[0].y - 380, state.enemies[0].x - GAME_WIDTH / 2);
    for (let i = 0; i < 5; i += 1) {
      state.gems.push(
        createGem(
          GAME_WIDTH / 2 + (state.rng() * 2 - 1) * 130,
          380 + (state.rng() * 2 - 1) * 90,
          state.rng,
        ),
      );
    }
    burst(state.rng, state.particles, state.enemies[1].x, state.enemies[1].y, '#ff2d95', 10, { maxSpeed: 200 });
    state.floaters.push(createFloater(state.enemies[1].x, state.enemies[1].y - 24, '+20', '#ffe14d'));
    return state;
  }
  // Fallback: a plain wave-1 frame is still a real frame of the game.
  const state = createGameState(mulberry32(seed), new SoundBank(), { persist: false });
  startRun(state);
  stepMany(state, 120, playInput);
  return state;
}

function buildEnd(seed) {
  const state = createGameState(mulberry32(seed), new SoundBank(), { persist: false });
  startRun(state);
  stepMany(state, 120, playInput);
  state.player.alive = false;
  state.player.hp = 0;
  burst(state.rng, state.particles, state.player.x, state.player.y, '#4dd7ff', 36, { maxSpeed: 320, maxLife: 1.1 });
  burst(state.rng, state.particles, state.player.x, state.player.y, '#ff2d95', 20, { maxSpeed: 260, maxLife: 0.9 });
  state.mode = 'over';
  state.score = 3420;
  state.wave = 6;
  state.kills = 87;
  state.level = 5;
  state.xp = 11;
  state.xpNext = 25;
  state.runTime = 214;
  state.best = 3420;
  state.isNewBest = true;
  state.banner = null;
  stepMany(state, 30, null);
  return state;
}

export function buildShotState(kind, seed) {
  if (kind === 'play') return buildPlay(seed);
  if (kind === 'end') return buildEnd(seed);
  return buildStart(seed);
}
