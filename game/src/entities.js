// Entity factories and definitions for NEON VOID.
// This file knows what things are (a player, four enemy kinds, bullets,
// XP gems, particles, floating combat text) and how they are born; the
// game loop in main.js decides how they move and die.
import { randRange, pick } from './rng.js';

export const ENEMY_KINDS = {
  drifter: {
    name: 'Drifter',
    color: '#ff2d95',
    glow: '#ff2d95',
    radius: 14,
    hp: 1,
    speed: 55,
    score: 10,
    cost: 1,
    shape: 'diamond',
    gems: 1,
  },
  dasher: {
    name: 'Dasher',
    color: '#ff9f1c',
    glow: '#ff9f1c',
    radius: 13,
    hp: 3,
    speed: 72,
    score: 20,
    cost: 2,
    shape: 'triangle',
    gems: 2,
  },
  brute: {
    name: 'Brute',
    color: '#b537f2',
    glow: '#b537f2',
    radius: 24,
    hp: 10,
    speed: 32,
    score: 40,
    cost: 3,
    shape: 'hexagon',
    gems: 3,
  },
};

export function createPlayer(x, y) {
  return {
    x,
    y,
    vx: 0,
    vy: 0,
    radius: 15,
    angle: -Math.PI / 2,
    hp: 100,
    maxHp: 100,
    speed: 265,
    fireRate: 3.2,
    damage: 1,
    multishot: 1,
    pierce: 0,
    bulletSpeed: 620,
    magnet: 95,
    fireTimer: 0,
    invuln: 0,
    trailTimer: 0,
    alive: true,
  };
}

export function createEnemy(kind, x, y, wave, elite, rng) {
  const def = ENEMY_KINDS[kind];
  const hpScale = 1 + 0.12 * (wave - 1);
  const speedScale = Math.min(1.6, 1 + 0.04 * (wave - 1));
  const base = {
    kind,
    x,
    y,
    vx: 0,
    vy: 0,
    radius: def.radius,
    color: def.color,
    glow: def.glow,
    shape: def.shape,
    hp: Math.round(def.hp * hpScale * (elite ? 6 : 1)),
    maxHp: 0,
    speed: def.speed * speedScale * (elite ? 1.3 : 1),
    score: def.score * (elite ? 5 : 1),
    gems: def.gems * (elite ? 4 : 1),
    elite: Boolean(elite),
    angle: randRange(rng, 0, Math.PI * 2),
    wobble: randRange(rng, 0, Math.PI * 2),
    wobbleSpeed: randRange(rng, 1.5, 3.5),
    chargeTimer: randRange(rng, 0.8, 2.0),
    charging: 0,
    flash: 0,
    spawnT: 0,
  };
  base.maxHp = base.hp;
  if (elite) base.radius = Math.round(def.radius * 1.7);
  return base;
}

export function createBullet(x, y, angle, damage, speed, pierce) {
  return {
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    damage,
    pierce,
    radius: 5,
    life: 1.1,
    hitSet: new Set(),
  };
}

export function createGem(x, y, rng) {
  return {
    x: x + randRange(rng, -8, 8),
    y: y + randRange(rng, -8, 8),
    vx: randRange(rng, -40, 40),
    vy: randRange(rng, -40, 40),
    radius: 7,
    value: 1,
    magnetized: false,
    bob: randRange(rng, 0, Math.PI * 2),
  };
}

export function createParticle(x, y, color, rng, options = {}) {
  const angle = randRange(rng, 0, Math.PI * 2);
  const speed = randRange(rng, options.minSpeed ?? 40, options.maxSpeed ?? 220);
  return {
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    life: randRange(rng, 0.3, options.maxLife ?? 0.7),
    maxLife: options.maxLife ?? 0.7,
    size: randRange(rng, 2, options.maxSize ?? 5),
    color,
    drag: options.drag ?? 0.9,
  };
}

export function burst(rng, list, x, y, color, count, options = {}) {
  for (let i = 0; i < count; i += 1) list.push(createParticle(x, y, color, rng, options));
}

export function createFloater(x, y, text, color) {
  return { x, y, text, color, life: 0.9, maxLife: 0.9 };
}

export function randomEdgePoint(rng, width, height, margin, player, minPlayerDistance) {
  for (let tries = 0; tries < 12; tries += 1) {
    const side = Math.floor(rng() * 4);
    let x;
    let y;
    if (side === 0) {
      x = randRange(rng, margin, width - margin);
      y = margin;
    } else if (side === 1) {
      x = randRange(rng, margin, width - margin);
      y = height - margin;
    } else if (side === 2) {
      x = margin;
      y = randRange(rng, margin, height - margin);
    } else {
      x = width - margin;
      y = randRange(rng, margin, height - margin);
    }
    const dx = x - player.x;
    const dy = y - player.y;
    if (dx * dx + dy * dy >= minPlayerDistance * minPlayerDistance) return { x, y };
  }
  return { x: margin, y: margin };
}

export function randomEnemyKind(rng, wave) {
  const pool = ['drifter', 'drifter', 'drifter', 'dasher'];
  if (wave >= 2) pool.push('dasher', 'dasher');
  if (wave >= 3) pool.push('brute');
  if (wave >= 5) pool.push('brute', 'dasher');
  return pick(rng, pool);
}
