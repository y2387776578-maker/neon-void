// Wave direction for NEON VOID.
// Each wave buys enemies from a point budget that grows with the wave
// number; the director trickles them in from the arena edges, waits for
// the arena to clear, then banners the next wave. Every fifth wave an
// elite joins the mix. Nothing here draws or collides: it only decides
// what spawns, when, and how the difficulty curve climbs.
import { createEnemy, randomEdgePoint, randomEnemyKind, ENEMY_KINDS } from './entities.js';
import { GAME_WIDTH, GAME_HEIGHT } from './input.js';

export class WaveDirector {
  constructor(rng) {
    this.rng = rng;
    this.wave = 0;
    this.queue = [];
    this.spawnTimer = 0;
    this.betweenTimer = 0;
    this.active = false;
    this.eliteSpawned = false;
  }

  budgetFor(wave) {
    return 6 + wave * 4;
  }

  buildQueue(wave) {
    const queue = [];
    let budget = this.budgetFor(wave);
    while (budget > 0) {
      const kind = randomEnemyKind(this.rng, wave);
      const cost = ENEMY_KINDS[kind].cost;
      if (cost > budget) break;
      queue.push(kind);
      budget -= cost;
    }
    // Shuffle so the wave never arrives in one predictable clump.
    for (let i = queue.length - 1; i > 0; i -= 1) {
      const j = Math.floor(this.rng() * (i + 1));
      const tmp = queue[i];
      queue[i] = queue[j];
      queue[j] = tmp;
    }
    return queue;
  }

  startWave(wave) {
    this.wave = wave;
    this.queue = this.buildQueue(wave);
    this.spawnTimer = 0.4;
    this.betweenTimer = 0;
    this.active = true;
    this.eliteSpawned = false;
  }

  startNextAfter(delay) {
    this.active = false;
    this.betweenTimer = delay;
    this.queue = [];
  }

  // Returns spawned enemies; the game loop owns the arrays.
  update(dt, player, spawnEnemy) {
    if (!this.active) {
      if (this.betweenTimer > 0) {
        this.betweenTimer -= dt;
        if (this.betweenTimer <= 0) return 'start';
      }
      return null;
    }
    if (this.queue.length > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnTimer = Math.max(0.25, 0.9 - this.wave * 0.05);
        const kind = this.queue.shift();
        const point = randomEdgePoint(this.rng, GAME_WIDTH, GAME_HEIGHT, 36, player, 260);
        spawnEnemy(createEnemy(kind, point.x, point.y, this.wave, false, this.rng));
        if (this.wave % 5 === 0 && !this.eliteSpawned && this.queue.length <= 2) {
          this.eliteSpawned = true;
          const elitePoint = randomEdgePoint(this.rng, GAME_WIDTH, GAME_HEIGHT, 36, player, 320);
          const eliteKind = this.wave >= 3 ? 'brute' : 'dasher';
          spawnEnemy(createEnemy(eliteKind, elitePoint.x, elitePoint.y, this.wave, true, this.rng));
        }
      }
    }
    return null;
  }

  isCleared(enemyCount) {
    return this.active && this.queue.length === 0 && enemyCount === 0;
  }
}
