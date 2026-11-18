// NEON VOID — entry point.
// Wires the canvas, the input and the loop together, and nothing else.
// Live play runs on requestAnimationFrame with a clamped delta; a URL
// like ?shot=play&seed=1 instead builds one deterministic frame and
// raises window.__shotReady when it is painted, which is how the three
// screenshots are taken. The game itself lives in game.js, the drawing
// in render.js.
import { mulberry32, hashSeed } from './rng.js';
import { Input, GAME_WIDTH, GAME_HEIGHT } from './input.js';
import { SoundBank } from './audio.js';
import { createGameState, stepGame, shakeOffset, loadBest } from './game.js';
import { drawWorld, drawHud, drawTitle, drawPause, drawLevelUp, drawGameOver } from './render.js';
import { buildShotState } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
if (!ctx) {
  document.body.textContent = 'NEON VOID needs a browser with canvas support.';
  throw new Error('no 2d context');
}

function renderFrame(state) {
  ctx.save();
  ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  const offset = shakeOffset(state);
  ctx.translate(offset.x, offset.y);
  drawWorld(ctx, state);
  ctx.restore();
  if (state.mode === 'title') {
    drawTitle(ctx, state);
    return;
  }
  drawHud(ctx, state);
  if (state.mode === 'levelup') drawLevelUp(ctx, state);
  else if (state.mode === 'paused') drawPause(ctx);
  else if (state.mode === 'over') drawGameOver(ctx, state);
}

function readShotParams() {
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  if (!shot) return null;
  const seedText = params.get('seed') || '1';
  const seed = /^\d+$/.test(seedText) ? Number(seedText) : hashSeed(seedText);
  return { shot, seed };
}

const shotParams = readShotParams();

if (shotParams) {
  // Deterministic render: build the state, paint one frame, signal readiness.
  const state = buildShotState(shotParams.shot, shotParams.seed);
  renderFrame(state);
  window.__shotReady = true;
  window.__game = state;
} else {
  const sound = new SoundBank();
  const state = createGameState(mulberry32((Math.random() * 0xffffffff) >>> 0), sound, { persist: true });
  loadBest(state);
  state.muted = sound.muted;
  const input = new Input(canvas);
  window.__game = state;

  window.addEventListener('blur', () => {
    if (state.mode === 'playing') state.mode = 'paused';
  });
  canvas.addEventListener('mousedown', () => sound.unlock());
  window.addEventListener('keydown', () => sound.unlock(), { once: false });

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.033, Math.max(0, (now - last) / 1000));
    last = now;
    const snapshot = {
      moveX: input.moveVector().x,
      moveY: input.moveVector().y,
      aimX: input.mouseX,
      aimY: input.mouseY,
      keys: new Set(input.justPressed),
      click: input.consumeClick(),
    };
    stepGame(state, snapshot, dt);
    renderFrame(state);
    input.endFrame();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
