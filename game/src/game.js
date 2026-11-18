// The simulation for NEON VOID: state, and one fixed step of it.
// This file owns every rule — movement, firing, collisions, gems,
// waves, level-ups, shake and banners — and nothing else. Rendering
// lives in render.js, input in input.js, sound in audio.js, so a frame
// of the game is always the same state drawn by the same painter,
// whether it is live play or a deterministic screenshot state.
import { clamp, distanceSquared, randRange, mulberry32 } from './rng.js';
import { GAME_WIDTH, GAME_HEIGHT } from './input.js';
import {
  createPlayer,
  createEnemy,
  createBullet,
  createGem,
  createParticle,
  createFloater,
  burst,
  randomEdgePoint,
  ENEMY_KINDS,
} from './entities.js';
import { WaveDirector } from './waves.js';
import { drawUpgradeChoices, xpNeededFor, UPGRADE_POOL } from './upgrades.js';
import { levelUpCardRect } from './render.js';

export function makeStars(rng) {
  const stars = [];
  const colors = ['#ffffff', '#9fd8ff', '#ffc4e3', '#c9f6ff'];
  for (let i = 0; i < 90; i += 1) {
    stars.push({
      x: randRange(rng, 0, GAME_WIDTH),
      y: randRange(rng, 0, GAME_HEIGHT),
      size: randRange(rng, 1, 2.4),
      phase: randRange(rng, 0, Math.PI * 2),
      speed: randRange(rng, 0.4, 1.6),
      alpha: randRange(rng, 0.25, 0.8),
      color: colors[Math.floor(rng() * colors.length)],
    });
  }
  return stars;
}

export function createGameState(rng, sound, options = {}) {
  return {
    rng,
    sound,
    persist: options.persist !== false,
    mode: 'title',
    time: 0,
    runTime: 0,
    wave: 0,
    score: 0,
    kills: 0,
    level: 1,
    xp: 0,
    xpNext: xpNeededFor(1),
    player: createPlayer(GAME_WIDTH / 2, GAME_HEIGHT / 2),
    enemies: [],
    bullets: [],
    gems: [],
    particles: [],
    floaters: [],
    director: new WaveDirector(rng),
    choices: [],
    pendingLevels: 0,
    ownedLevels: {},
    hoverCard: -1,
    shakeT: 0,
    shakeDur: 1,
    shakeMag: 0,
    banner: null,
    best: 0,
    isNewBest: false,
    stars: makeStars(rng),
    muted: sound ? sound.muted : false,
    demoSeeded: false,
  };
}

export function loadBest(state) {
  if (!state.persist) return;
  try {
    state.best = Number(window.localStorage.getItem('neonvoid.best') || 0) || 0;
  } catch (err) {
    state.best = 0;
  }
}

export function saveBest(state) {
  if (!state.persist) return;
  try {
    window.localStorage.setItem('neonvoid.best', String(state.best));
  } catch (err) {
    /* storage unavailable: the best score lives only in memory */
  }
}

export function startRun(state) {
  state.mode = 'playing';
  state.runTime = 0;
  state.wave = 0;
  state.score = 0;
  state.kills = 0;
  state.level = 1;
  state.xp = 0;
  state.xpNext = xpNeededFor(1);
  state.player = createPlayer(GAME_WIDTH / 2, GAME_HEIGHT / 2);
  state.enemies = [];
  state.bullets = [];
  state.gems = [];
  state.particles = [];
  state.floaters = [];
  state.choices = [];
  state.pendingLevels = 0;
  state.ownedLevels = {};
  state.hoverCard = -1;
  state.shakeT = 0;
  state.banner = null;
  state.isNewBest = false;
  state.director = new WaveDirector(state.rng);
  state.director.startWave(1);
  state.wave = 1;
  setBanner(state, 'WAVE 1', 'Survive the swarm');
  if (state.sound) state.sound.waveStart();
}

export function setBanner(state, text, sub) {
  state.banner = { text, sub: sub || '', t: 2.2 };
}

export function addShake(state, magnitude, duration) {
  state.shakeMag = Math.max(state.shakeMag, magnitude);
  state.shakeT = Math.max(state.shakeT, duration);
  state.shakeDur = duration;
}

export function shakeOffset(state) {
  if (state.shakeT <= 0) return { x: 0, y: 0 };
  const ratio = state.shakeT / state.shakeDur;
  const mag = state.shakeMag * ratio;
  return {
    x: (state.rng() * 2 - 1) * mag,
    y: (state.rng() * 2 - 1) * mag,
  };
}

function seedDemoArena(state) {
  if (state.demoSeeded) return;
  state.demoSeeded = true;
  const kinds = ['drifter', 'drifter', 'dasher', 'drifter', 'brute', 'dasher'];
  for (const kind of kinds) {
    const point = randomEdgePoint(state.rng, GAME_WIDTH, GAME_HEIGHT, 90, state.player, 200);
    state.enemies.push(createEnemy(kind, point.x, point.y, 1, false, state.rng));
  }
}

function firePlayer(state) {
  const player = state.player;
  const n = player.multishot;
  for (let i = 0; i < n; i += 1) {
    const offset = (i - (n - 1) / 2) * 0.09;
    const angle = player.angle + offset;
    state.bullets.push(
      createBullet(
        player.x + Math.cos(angle) * 20,
        player.y + Math.sin(angle) * 20,
        angle,
        player.damage,
        player.bulletSpeed,
        player.pierce,
      ),
    );
  }
  player.fireTimer = 1 / player.fireRate;
  if (state.sound) state.sound.shoot();
}

function damageEnemy(state, enemy, damage, bullet) {
  enemy.hp -= damage;
  enemy.flash = 0.12;
  if (state.floaters.length < 24) {
    state.floaters.push(createFloater(enemy.x, enemy.y - enemy.radius - 8, String(Math.round(damage * 10) / 10), '#ffe14d'));
  }
  if (state.sound) state.sound.enemyHit();
  if (enemy.hp > 0) return;
  killEnemy(state, enemy, bullet);
}

function killEnemy(state, enemy, bullet) {
  enemy.dead = true;
  state.kills += 1;
  state.score += enemy.score;
  burst(state.rng, state.particles, enemy.x, enemy.y, enemy.color, enemy.elite ? 26 : 12, { maxSpeed: 260 });
  burst(state.rng, state.particles, enemy.x, enemy.y, '#ffffff', 4, { maxSpeed: 140 });
  if (state.sound) state.sound.explode(enemy.elite);
  if (enemy.elite) {
    addShake(state, 7, 0.35);
    state.floaters.push(createFloater(enemy.x, enemy.y - 20, `ELITE DOWN +${enemy.score}`, '#ffe14d'));
  }
  for (let i = 0; i < enemy.gems; i += 1) {
    state.gems.push(createGem(enemy.x, enemy.y, state.rng));
  }
}

function hurtPlayer(state, enemy) {
  const player = state.player;
  if (player.invuln > 0 || !player.alive) return;
  const damage = enemy.shape === 'hexagon' ? 20 : enemy.elite ? 18 : 12;
  player.hp -= damage;
  player.invuln = 0.9;
  addShake(state, 10, 0.4);
  burst(state.rng, state.particles, player.x, player.y, '#ff4d6d', 14, { maxSpeed: 240 });
  state.floaters.push(createFloater(player.x, player.y - 24, `-${damage}`, '#ff5d7a'));
  if (state.sound) state.sound.playerHit();
  if (player.hp <= 0) {
    player.hp = 0;
    player.alive = false;
    burst(state.rng, state.particles, player.x, player.y, '#4dd7ff', 40, { maxSpeed: 320, maxLife: 1.1 });
    burst(state.rng, state.particles, player.x, player.y, '#ff2d95', 24, { maxSpeed: 260, maxLife: 0.9 });
    addShake(state, 14, 0.7);
    if (state.sound) state.sound.gameOver();
    state.mode = 'over';
    if (state.score > state.best) {
      state.best = state.score;
      state.isNewBest = true;
      saveBest(state);
    }
  }
}

function updatePlayer(state, input, dt) {
  const player = state.player;
  if (!player.alive) return;
  const move = { x: input.moveX, y: input.moveY };
  const accel = 2400;
  player.vx += move.x * accel * dt;
  player.vy += move.y * accel * dt;
  const damp = Math.exp(-6 * dt);
  player.vx *= damp;
  player.vy *= damp;
  const speed = Math.hypot(player.vx, player.vy);
  if (speed > player.speed) {
    player.vx = (player.vx / speed) * player.speed;
    player.vy = (player.vy / speed) * player.speed;
  }
  player.x = clamp(player.x + player.vx * dt, 24, GAME_WIDTH - 24);
  player.y = clamp(player.y + player.vy * dt, 24, GAME_HEIGHT - 24);
  player.angle = Math.atan2(input.aimY - player.y, input.aimX - player.x);
  if (player.invuln > 0) player.invuln -= dt;

  // Engine trail.
  player.trailTimer -= dt;
  if (speed > 60 && player.trailTimer <= 0) {
    player.trailTimer = 0.03;
    state.particles.push(
      createParticle(player.x - Math.cos(player.angle) * 14, player.y - Math.sin(player.angle) * 14, '#4dd7ff', state.rng, {
        minSpeed: 10,
        maxSpeed: 40,
        maxLife: 0.35,
        maxSize: 3,
      }),
    );
  }

  // Auto-fire at the aim point.
  player.fireTimer -= dt;
  if (player.fireTimer <= 0) firePlayer(state);
}

function updateEnemies(state, dt) {
  const player = state.player;
  for (const enemy of state.enemies) {
    if (enemy.spawnT < 0.35) enemy.spawnT += dt;
    if (enemy.flash > 0) enemy.flash -= dt;
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const dist = Math.hypot(dx, dy) || 1;
    const nx = dx / dist;
    const ny = dy / dist;
    enemy.wobble += dt * enemy.wobbleSpeed;
    if (enemy.kind === 'dasher') {
      if (enemy.charging > 0) {
        enemy.charging -= dt;
        enemy.vx = nx * 300;
        enemy.vy = ny * 300;
      } else {
        enemy.chargeTimer -= dt;
        if (enemy.chargeTimer <= 0 && dist < 420) {
          enemy.charging = 0.45;
          enemy.chargeTimer = randRange(state.rng, 1.4, 2.4);
        }
        enemy.vx = nx * enemy.speed + Math.cos(enemy.wobble) * 26;
        enemy.vy = ny * enemy.speed + Math.sin(enemy.wobble) * 26;
      }
    } else {
      const wobble = Math.sin(enemy.wobble) * 0.35;
      const px = -ny * wobble;
      const py = nx * wobble;
      enemy.vx = (nx + px) * enemy.speed;
      enemy.vy = (ny + py) * enemy.speed;
    }
    enemy.x += enemy.vx * dt;
    enemy.y += enemy.vy * dt;
    enemy.x = clamp(enemy.x, 20, GAME_WIDTH - 20);
    enemy.y = clamp(enemy.y, 20, GAME_HEIGHT - 20);
    enemy.angle = Math.atan2(enemy.vy, enemy.vx);
  }

  // Enemies push each other apart so they never stack into one blob.
  const list = state.enemies;
  for (let i = 0; i < list.length; i += 1) {
    for (let j = i + 1; j < list.length; j += 1) {
      const a = list[i];
      const b = list[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const min = a.radius + b.radius - 2;
      const d2 = dx * dx + dy * dy;
      if (d2 > 0.01 && d2 < min * min) {
        const d = Math.sqrt(d2);
        const push = (min - d) / 2;
        const ux = dx / d;
        const uy = dy / d;
        a.x -= ux * push;
        a.y -= uy * push;
        b.x += ux * push;
        b.y += uy * push;
      }
    }
  }
}

function updateBullets(state, dt) {
  for (const bullet of state.bullets) {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;
    if (bullet.x < 8 || bullet.x > GAME_WIDTH - 8 || bullet.y < 8 || bullet.y > GAME_HEIGHT - 8) bullet.life = 0;
    if (bullet.life <= 0) continue;
    for (const enemy of state.enemies) {
      if (enemy.dead || bullet.hitSet.has(enemy)) continue;
      const rr = enemy.radius + bullet.radius;
      if (distanceSquared(bullet.x, bullet.y, enemy.x, enemy.y) < rr * rr) {
        bullet.hitSet.add(enemy);
        damageEnemy(state, enemy, bullet.damage, bullet);
        burst(state.rng, state.particles, bullet.x, bullet.y, enemy.color, 4, { maxSpeed: 160, maxLife: 0.35 });
        if (bullet.pierce <= 0) {
          bullet.life = 0;
          break;
        }
        bullet.pierce -= 1;
      }
    }
  }
  state.bullets = state.bullets.filter((b) => b.life > 0);
  state.enemies = state.enemies.filter((e) => !e.dead);
}

function updateGems(state, dt) {
  const player = state.player;
  for (const gem of state.gems) {
    gem.bob += dt * 3;
    gem.x += gem.vx * dt;
    gem.y += gem.vy * dt;
    gem.vx *= Math.exp(-3 * dt);
    gem.vy *= Math.exp(-3 * dt);
    const d2 = distanceSquared(gem.x, gem.y, player.x, player.y);
    if (player.alive && d2 < player.magnet * player.magnet) {
      const d = Math.sqrt(d2) || 1;
      const pull = 900 * dt;
      gem.vx += ((player.x - gem.x) / d) * pull;
      gem.vy += ((player.y - gem.y) / d) * pull;
    }
    if (player.alive && d2 < 26 * 26) {
      gem.taken = true;
      state.xp += gem.value;
      if (state.sound) state.sound.gemPickup();
    }
  }
  state.gems = state.gems.filter((g) => !g.taken);
  while (state.xp >= state.xpNext) {
    state.xp -= state.xpNext;
    state.level += 1;
    state.xpNext = xpNeededFor(state.level);
    state.pendingLevels += 1;
  }
  if (state.pendingLevels > 0 && state.mode === 'playing') {
    state.pendingLevels -= 1;
    state.choices = drawUpgradeChoices(state.rng, state.ownedLevels);
    state.hoverCard = -1;
    state.mode = 'levelup';
    if (state.sound) state.sound.levelUp();
  }
}

function updateParticles(state, dt) {
  for (const p of state.particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    const damp = Math.pow(p.drag, dt * 60);
    p.vx *= damp;
    p.vy *= damp;
    p.life -= dt;
  }
  state.particles = state.particles.filter((p) => p.life > 0);
  for (const f of state.floaters) {
    f.y -= 34 * dt;
    f.life -= dt;
  }
  state.floaters = state.floaters.filter((f) => f.life > 0);
}

function updatePlaying(state, input, dt) {
  state.runTime += dt;
  updatePlayer(state, input, dt);
  updateEnemies(state, dt);
  updateBullets(state, dt);
  updateGems(state, dt);
  updateParticles(state, dt);

  // Touching an enemy hurts.
  if (state.player.alive) {
    for (const enemy of state.enemies) {
      const rr = enemy.radius + state.player.radius - 4;
      if (distanceSquared(enemy.x, enemy.y, state.player.x, state.player.y) < rr * rr) {
        hurtPlayer(state, enemy);
        if (!state.player.alive) break;
      }
    }
  }

  // Wave flow.
  const director = state.director;
  const signal = director.update(dt, state.player, (enemy) => state.enemies.push(enemy));
  if (signal === 'start') {
    director.startWave(director.wave + 1);
    state.wave = director.wave;
    setBanner(state, `WAVE ${state.wave}`, state.wave % 5 === 0 ? 'Elite on the field' : '');
    if (state.sound) state.sound.waveStart();
  } else if (director.isCleared(state.enemies.length)) {
    const bonus = 50 + state.wave * 25;
    state.score += bonus;
    state.floaters.push(createFloater(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 120, `WAVE CLEAR +${bonus}`, '#7dff9e'));
    setBanner(state, `WAVE ${state.wave} CLEAR`, `Bonus +${bonus}`);
    director.startNextAfter(2.4);
  }

  if (state.banner && state.banner.t > 0) state.banner.t -= dt;
  if (state.shakeT > 0) state.shakeT -= dt;
}

function pickUpgrade(state, index) {
  const choice = state.choices[index];
  if (!choice) return;
  const def = UPGRADE_POOL.find((item) => item.id === choice.id);
  if (def) def.apply(state.player);
  state.ownedLevels[choice.id] = (state.ownedLevels[choice.id] || 0) + 1;
  state.choices = [];
  state.hoverCard = -1;
  if (state.sound) state.sound.cardPick();
  if (state.pendingLevels > 0) {
    state.pendingLevels -= 1;
    state.choices = drawUpgradeChoices(state.rng, state.ownedLevels);
    return;
  }
  state.mode = 'playing';
}

// One frame of the game. `input` is a plain snapshot:
// { moveX, moveY, aimX, aimY, keys:Set of just-pressed codes, click:{x,y}|null }
export function stepGame(state, input, dt) {
  state.time += dt;
  if (input.keys.has('KeyM')) {
    if (state.sound) {
      state.sound.setMuted(!state.sound.muted);
      state.muted = state.sound.muted;
    }
  }

  if (state.mode === 'title') {
    seedDemoArena(state);
    updateEnemies(state, dt);
    updateParticles(state, dt);
    if (input.keys.has('Enter') || input.keys.has('Space') || input.click) {
      if (state.sound) state.sound.unlock();
      if (state.sound) state.sound.click();
      startRun(state);
    }
    return;
  }

  if (state.mode === 'playing') {
    if (input.keys.has('KeyP') || input.keys.has('Escape')) {
      state.mode = 'paused';
      return;
    }
    updatePlaying(state, input, dt);
    return;
  }

  if (state.mode === 'levelup') {
    // Track the card under the mouse for the hover glow.
    state.hoverCard = -1;
    for (let i = 0; i < state.choices.length; i += 1) {
      const rect = levelUpCardRect(i);
      if (input.aimX >= rect.x && input.aimX <= rect.x + rect.w && input.aimY >= rect.y && input.aimY <= rect.y + rect.h) {
        state.hoverCard = i;
      }
    }
    if (input.keys.has('Digit1')) pickUpgrade(state, 0);
    else if (input.keys.has('Digit2')) pickUpgrade(state, 1);
    else if (input.keys.has('Digit3')) pickUpgrade(state, 2);
    else if (input.click) {
      for (let i = 0; i < state.choices.length; i += 1) {
        const rect = levelUpCardRect(i);
        if (input.click.x >= rect.x && input.click.x <= rect.x + rect.w && input.click.y >= rect.y && input.click.y <= rect.y + rect.h) {
          pickUpgrade(state, i);
          break;
        }
      }
    }
    updateParticles(state, dt);
    return;
  }

  if (state.mode === 'paused') {
    if (input.keys.has('KeyP') || input.keys.has('Escape') || input.keys.has('Enter')) {
      state.mode = 'playing';
      return;
    }
    if (input.keys.has('KeyR')) {
      startRun(state);
    }
    return;
  }

  if (state.mode === 'over') {
    updateParticles(state, dt);
    if (state.shakeT > 0) state.shakeT -= dt;
    if (input.keys.has('KeyR') || input.keys.has('Enter') || input.keys.has('Space') || input.click) {
      if (state.sound) state.sound.click();
      startRun(state);
    }
  }
}
