// All canvas drawing for NEON VOID.
// Nothing here changes game state: it reads the state main.js owns and
// paints it — the arena, the ships, the particles, the HUD and every
// menu screen. The same functions draw live play and the deterministic
// screenshot states, so a screenshot is always a real frame of the game.
import { GAME_WIDTH, GAME_HEIGHT } from './input.js';

const FONT = '"Segoe UI", system-ui, -apple-system, sans-serif';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function glowText(ctx, text, x, y, font, color, glowColor, glowBlur = 18) {
  ctx.save();
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = glowBlur;
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawPolygon(ctx, x, y, radius, sides, rotation) {
  ctx.beginPath();
  for (let i = 0; i < sides; i += 1) {
    const a = rotation + (i / sides) * Math.PI * 2;
    const px = x + Math.cos(a) * radius;
    const py = y + Math.sin(a) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

export function drawBackground(ctx, game) {
  ctx.fillStyle = '#050510';
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  // Starfield with a slow twinkle.
  for (const star of game.stars) {
    const twinkle = 0.35 + 0.65 * Math.abs(Math.sin(game.time * star.speed + star.phase));
    ctx.globalAlpha = twinkle * star.alpha;
    ctx.fillStyle = star.color;
    ctx.fillRect(star.x, star.y, star.size, star.size);
  }
  ctx.globalAlpha = 1;

  // Faint grid.
  ctx.strokeStyle = 'rgba(90, 80, 255, 0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 80; x < GAME_WIDTH; x += 80) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, GAME_HEIGHT);
  }
  for (let y = 80; y < GAME_HEIGHT; y += 80) {
    ctx.moveTo(0, y);
    ctx.lineTo(GAME_WIDTH, y);
  }
  ctx.stroke();

  // Arena border glow.
  ctx.save();
  ctx.strokeStyle = 'rgba(77, 215, 255, 0.55)';
  ctx.shadowColor = '#4dd7ff';
  ctx.shadowBlur = 14;
  ctx.lineWidth = 2;
  ctx.strokeRect(6, 6, GAME_WIDTH - 12, GAME_HEIGHT - 12);
  ctx.restore();
}

export function drawGem(ctx, gem, time) {
  const pulse = 1 + 0.18 * Math.sin(time * 5 + gem.bob);
  const r = gem.radius * pulse;
  ctx.save();
  ctx.translate(gem.x, gem.y);
  ctx.rotate(Math.PI / 4);
  ctx.shadowColor = '#4dd7ff';
  ctx.shadowBlur = 10;
  ctx.fillStyle = '#aef4ff';
  ctx.fillRect(-r / 2, -r / 2, r, r);
  ctx.fillStyle = '#2fb9e8';
  ctx.fillRect(-r / 4, -r / 4, r / 2, r / 2);
  ctx.restore();
}

export function drawBullet(ctx, bullet) {
  ctx.save();
  ctx.strokeStyle = '#ffe14d';
  ctx.shadowColor = '#ffe14d';
  ctx.shadowBlur = 12;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(bullet.x - bullet.vx * 0.018, bullet.y - bullet.vy * 0.018);
  ctx.lineTo(bullet.x, bullet.y);
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(bullet.x, bullet.y, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawEnemy(ctx, enemy, time) {
  ctx.save();
  ctx.translate(enemy.x, enemy.y);
  const flash = enemy.flash > 0;
  const color = flash ? '#ffffff' : enemy.color;
  ctx.shadowColor = enemy.glow;
  ctx.shadowBlur = enemy.elite ? 22 : 14;
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  const wobble = Math.sin(time * enemy.wobbleSpeed + enemy.wobble) * 0.12;
  if (enemy.shape === 'diamond') {
    ctx.rotate(enemy.angle + wobble);
    ctx.beginPath();
    ctx.moveTo(0, -enemy.radius);
    ctx.lineTo(enemy.radius * 0.8, 0);
    ctx.lineTo(0, enemy.radius);
    ctx.lineTo(-enemy.radius * 0.8, 0);
    ctx.closePath();
    ctx.fill();
  } else if (enemy.shape === 'triangle') {
    ctx.rotate(enemy.angle);
    drawPolygon(ctx, 0, 0, enemy.radius, 3, 0);
    ctx.fill();
  } else {
    ctx.rotate(wobble);
    drawPolygon(ctx, 0, 0, enemy.radius, 6, 0);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(5, 5, 16, 0.85)';
    drawPolygon(ctx, 0, 0, enemy.radius * 0.55, 6, Math.PI / 6);
    ctx.fill();
  }
  if (enemy.elite) {
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#ffe14d';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, enemy.radius + 7 + Math.sin(time * 4) * 2, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  // Health bar for the tough ones.
  if ((enemy.shape === 'hexagon' || enemy.elite) && enemy.hp < enemy.maxHp) {
    const w = enemy.radius * 2;
    const ratio = Math.max(0, enemy.hp / enemy.maxHp);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.fillRect(enemy.x - w / 2, enemy.y - enemy.radius - 12, w, 5);
    ctx.fillStyle = enemy.elite ? '#ffe14d' : '#ff5d8f';
    ctx.fillRect(enemy.x - w / 2, enemy.y - enemy.radius - 12, w * ratio, 5);
  }
}

export function drawPlayer(ctx, player, time) {
  if (!player.alive) return;
  const blink = player.invuln > 0 && Math.floor(time * 14) % 2 === 0;
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.angle);
  if (!blink) {
    ctx.shadowColor = '#4dd7ff';
    ctx.shadowBlur = 20;
    // Engine flame.
    const flame = 10 + Math.sin(time * 30) * 4;
    ctx.fillStyle = '#ff9f1c';
    ctx.beginPath();
    ctx.moveTo(-12, 6);
    ctx.lineTo(-12 - flame, 0);
    ctx.lineTo(-12, -6);
    ctx.closePath();
    ctx.fill();
    // Hull: a sharp neon dart.
    ctx.fillStyle = '#d9fbff';
    ctx.strokeStyle = '#4dd7ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(-12, 11);
    ctx.lineTo(-6, 0);
    ctx.lineTo(-12, -11);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ff2d95';
    ctx.beginPath();
    ctx.arc(2, 0, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawParticles(ctx, particles) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const p of particles) {
    const ratio = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = ratio;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * ratio + 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

export function drawFloaters(ctx, floaters) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 15px ${FONT}`;
  for (const f of floaters) {
    const ratio = Math.max(0, f.life / f.maxLife);
    ctx.globalAlpha = ratio;
    ctx.shadowColor = f.color;
    ctx.shadowBlur = 8;
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

export function drawWorld(ctx, game) {
  drawBackground(ctx, game);
  for (const gem of game.gems) drawGem(ctx, gem, game.time);
  for (const bullet of game.bullets) drawBullet(ctx, bullet);
  for (const enemy of game.enemies) drawEnemy(ctx, enemy, game.time);
  drawPlayer(ctx, game.player, game.time);
  drawParticles(ctx, game.particles);
  drawFloaters(ctx, game.floaters);
}

function drawBar(ctx, x, y, w, h, ratio, fill, glow) {
  ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fill();
  if (ratio > 0) {
    ctx.save();
    ctx.shadowColor = glow;
    ctx.shadowBlur = 8;
    ctx.fillStyle = fill;
    roundRect(ctx, x, y, Math.max(h, w * ratio), h, h / 2);
    ctx.fill();
    ctx.restore();
  }
}

export function drawHud(ctx, game) {
  const player = game.player;
  // Hull bar.
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = `700 13px ${FONT}`;
  ctx.fillStyle = '#9fd8ff';
  ctx.fillText('HULL', 28, 30);
  drawBar(ctx, 28, 42, 230, 14, player.hp / player.maxHp, '#ff4d6d', '#ff4d6d');
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 13px ${FONT}`;
  ctx.fillText(`${Math.ceil(player.hp)} / ${player.maxHp}`, 266, 49);
  ctx.fillStyle = '#9fd8ff';
  ctx.fillText(`LV ${game.level}`, 28, 76);
  ctx.restore();

  // Wave and score.
  glowText(ctx, `WAVE ${game.wave}`, GAME_WIDTH / 2, 34, `800 26px ${FONT}`, '#ffffff', '#4dd7ff', 14);
  ctx.save();
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.font = `700 15px ${FONT}`;
  ctx.fillStyle = '#ffe14d';
  ctx.fillText(`SCORE ${game.score.toLocaleString('en-US')}`, GAME_WIDTH - 28, 30);
  ctx.fillStyle = '#9fd8ff';
  ctx.font = `600 13px ${FONT}`;
  ctx.fillText(`BEST ${Math.max(game.best, game.score).toLocaleString('en-US')}`, GAME_WIDTH - 28, 52);
  ctx.fillText(`KILLS ${game.kills}`, GAME_WIDTH - 28, 74);
  ctx.restore();

  // XP bar along the bottom.
  const xpRatio = game.xpNext > 0 ? game.xp / game.xpNext : 0;
  drawBar(ctx, 28, GAME_HEIGHT - 30, GAME_WIDTH - 56, 10, xpRatio, '#4dd7ff', '#4dd7ff');
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = `700 12px ${FONT}`;
  ctx.fillStyle = '#9fd8ff';
  ctx.fillText(`XP ${game.xp} / ${game.xpNext}`, 28, GAME_HEIGHT - 46);
  ctx.textAlign = 'right';
  ctx.fillText(game.muted ? 'M: SOUND OFF' : 'M: SOUND ON', GAME_WIDTH - 28, GAME_HEIGHT - 46);
  ctx.restore();

  // Wave banner.
  if (game.banner && game.banner.t > 0) {
    const alpha = Math.min(1, game.banner.t * 2);
    ctx.save();
    ctx.globalAlpha = alpha;
    glowText(ctx, game.banner.text, GAME_WIDTH / 2, GAME_HEIGHT / 2 - 90, `900 44px ${FONT}`, '#ffffff', '#ff2d95', 24);
    if (game.banner.sub) {
      glowText(ctx, game.banner.sub, GAME_WIDTH / 2, GAME_HEIGHT / 2 - 48, `600 18px ${FONT}`, '#c9f6ff', '#4dd7ff', 10);
    }
    ctx.restore();
  }
}

export function drawTitle(ctx, game) {
  ctx.save();
  ctx.fillStyle = 'rgba(3, 3, 12, 0.62)';
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  ctx.restore();
  glowText(ctx, 'NEON VOID', GAME_WIDTH / 2, 218, `900 92px ${FONT}`, '#eafcff', '#4dd7ff', 32);
  glowText(ctx, 'A NEON ARENA SURVIVAL GAME', GAME_WIDTH / 2, 288, `600 21px ${FONT}`, '#ff9de2', '#ff2d95', 14);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `600 18px ${FONT}`;
  ctx.fillStyle = '#c9f6ff';
  ctx.fillText('WASD move  ·  mouse aims  ·  your ship fires on its own', GAME_WIDTH / 2, 352);
  ctx.fillText('Collect XP gems, level up, pick upgrades, survive the waves', GAME_WIDTH / 2, 384);
  ctx.fillText('P pauses  ·  M mutes  ·  elites drop a shower of gems', GAME_WIDTH / 2, 416);
  ctx.restore();
  const blink = 0.55 + 0.45 * Math.sin(game.time * 3.2);
  ctx.save();
  ctx.globalAlpha = blink;
  glowText(ctx, 'CLICK OR PRESS ENTER TO START', GAME_WIDTH / 2, 492, `800 26px ${FONT}`, '#ffe14d', '#ffb347', 16);
  ctx.restore();
  if (game.best > 0) {
    glowText(ctx, `BEST SCORE  ${game.best.toLocaleString('en-US')}`, GAME_WIDTH / 2, 548, `700 18px ${FONT}`, '#9fd8ff', '#4dd7ff', 8);
  }
}

export function drawPause(ctx) {
  ctx.save();
  ctx.fillStyle = 'rgba(3, 3, 12, 0.66)';
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  ctx.restore();
  glowText(ctx, 'PAUSED', GAME_WIDTH / 2, 320, `900 64px ${FONT}`, '#eafcff', '#4dd7ff', 26);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `600 18px ${FONT}`;
  ctx.fillStyle = '#c9f6ff';
  ctx.fillText('P or ESC to resume  ·  R to restart', GAME_WIDTH / 2, 396);
  ctx.restore();
}

export function levelUpCardRect(index) {
  const cardW = 300;
  const cardH = 190;
  const gap = 28;
  const totalW = cardW * 3 + gap * 2;
  const startX = (GAME_WIDTH - totalW) / 2;
  return { x: startX + index * (cardW + gap), y: 240, w: cardW, h: cardH };
}

export function drawLevelUp(ctx, game) {
  ctx.save();
  ctx.fillStyle = 'rgba(3, 3, 12, 0.68)';
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  ctx.restore();
  glowText(ctx, 'LEVEL UP!', GAME_WIDTH / 2, 128, `900 52px ${FONT}`, '#ffe14d', '#ffb347', 24);
  glowText(ctx, 'Choose one upgrade — press 1, 2 or 3, or click a card', GAME_WIDTH / 2, 178, `600 17px ${FONT}`, '#c9f6ff', '#4dd7ff', 8);
  const cardW = 300;
  const cardH = 190;
  game.choices.forEach((choice, i) => {
    const rect = levelUpCardRect(i);
    const x = rect.x;
    const y = rect.y;
    const hovered = game.hoverCard === i;
    ctx.save();
    ctx.shadowColor = choice.color;
    ctx.shadowBlur = hovered ? 26 : 12;
    ctx.fillStyle = hovered ? 'rgba(28, 28, 64, 0.98)' : 'rgba(14, 14, 36, 0.95)';
    roundRect(ctx, x, y, cardW, cardH, 14);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = choice.color;
    ctx.lineWidth = hovered ? 3 : 1.5;
    roundRect(ctx, x, y, cardW, cardH, 14);
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = choice.color;
    ctx.font = `800 22px ${FONT}`;
    ctx.fillText(choice.name, x + cardW / 2, y + 52);
    ctx.fillStyle = '#eafcff';
    ctx.font = `600 17px ${FONT}`;
    ctx.fillText(choice.desc, x + cardW / 2, y + 96);
    ctx.fillStyle = '#9fd8ff';
    ctx.font = `700 14px ${FONT}`;
    const pips = '●'.repeat(choice.level) + '○'.repeat(Math.max(0, choice.maxLevel - choice.level));
    ctx.fillText(`LEVEL ${choice.level} / ${choice.maxLevel}   ${pips}`, x + cardW / 2, y + 136);
    ctx.fillStyle = '#ffe14d';
    ctx.font = `800 16px ${FONT}`;
    ctx.fillText(`[ ${i + 1} ]`, x + cardW / 2, y + cardH - 26);
    ctx.restore();
  });
}

export function drawGameOver(ctx, game) {
  ctx.save();
  ctx.fillStyle = 'rgba(8, 2, 10, 0.72)';
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  ctx.restore();
  glowText(ctx, 'GAME OVER', GAME_WIDTH / 2, 168, `900 72px ${FONT}`, '#ff5d7a', '#ff2d55', 30);
  if (game.isNewBest) {
    glowText(ctx, '★ NEW BEST SCORE ★', GAME_WIDTH / 2, 232, `800 24px ${FONT}`, '#ffe14d', '#ffb347', 18);
  }
  const stats = [
    ['SCORE', game.score.toLocaleString('en-US')],
    ['WAVE REACHED', String(game.wave)],
    ['ENEMIES DESTROYED', String(game.kills)],
    ['TIME SURVIVED', formatTime(game.runTime)],
    ['BEST', Math.max(game.best, game.score).toLocaleString('en-US')],
  ];
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  stats.forEach((row, i) => {
    const y = 292 + i * 40;
    ctx.font = `700 16px ${FONT}`;
    ctx.fillStyle = '#9fd8ff';
    ctx.textAlign = 'right';
    ctx.fillText(row[0], GAME_WIDTH / 2 - 24, y);
    ctx.fillStyle = '#ffffff';
    ctx.font = `800 20px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText(row[1], GAME_WIDTH / 2 + 24, y);
  });
  ctx.restore();
  const blink = 0.55 + 0.45 * Math.sin(game.time * 3.2);
  ctx.save();
  ctx.globalAlpha = blink;
  glowText(ctx, 'PRESS R OR CLICK TO PLAY AGAIN', GAME_WIDTH / 2, 540, `800 24px ${FONT}`, '#ffe14d', '#ffb347', 16);
  ctx.restore();
}

export function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
