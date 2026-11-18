// Keyboard and mouse state for NEON VOID.
// Tracks held keys, edge-triggered presses (justPressed, cleared once per
// frame by the game loop) and the mouse position in the canvas's logical
// 1280x720 coordinates, whatever size the canvas is drawn at on screen.
import { clamp } from './rng.js';

export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

const GAME_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'KeyP', 'KeyM', 'KeyR', 'Enter', 'Space',
  'Digit1', 'Digit2', 'Digit3', 'Escape',
]);

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.held = new Set();
    this.justPressed = new Set();
    this.mouseX = GAME_WIDTH / 2;
    this.mouseY = GAME_HEIGHT / 2 - 120;
    this.mouseDown = false;
    this.mouseClicked = false;
    this.mouseClickX = 0;
    this.mouseClickY = 0;
    this.onKeyDown = null;

    window.addEventListener('keydown', (event) => {
      if (GAME_KEYS.has(event.code)) event.preventDefault();
      if (!event.repeat) {
        this.held.add(event.code);
        this.justPressed.add(event.code);
        if (this.onKeyDown) this.onKeyDown(event.code);
      }
    });
    window.addEventListener('keyup', (event) => {
      this.held.delete(event.code);
    });
    window.addEventListener('blur', () => {
      this.held.clear();
    });
    canvas.addEventListener('mousemove', (event) => {
      const point = this.toLogical(event.clientX, event.clientY);
      this.mouseX = point.x;
      this.mouseY = point.y;
    });
    canvas.addEventListener('mousedown', (event) => {
      const point = this.toLogical(event.clientX, event.clientY);
      this.mouseX = point.x;
      this.mouseY = point.y;
      this.mouseDown = true;
      this.mouseClicked = true;
      this.mouseClickX = point.x;
      this.mouseClickY = point.y;
    });
    window.addEventListener('mouseup', () => {
      this.mouseDown = false;
    });
    canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  }

  toLogical(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: clamp(((clientX - rect.left) / rect.width) * GAME_WIDTH, 0, GAME_WIDTH),
      y: clamp(((clientY - rect.top) / rect.height) * GAME_HEIGHT, 0, GAME_HEIGHT),
    };
  }

  isHeld(code) {
    return this.held.has(code);
  }

  pressed(code) {
    return this.justPressed.has(code);
  }

  moveVector() {
    let x = 0;
    let y = 0;
    if (this.isHeld('KeyA') || this.isHeld('ArrowLeft')) x -= 1;
    if (this.isHeld('KeyD') || this.isHeld('ArrowRight')) x += 1;
    if (this.isHeld('KeyW') || this.isHeld('ArrowUp')) y -= 1;
    if (this.isHeld('KeyS') || this.isHeld('ArrowDown')) y += 1;
    if (x !== 0 && y !== 0) {
      const inv = 1 / Math.sqrt(2);
      x *= inv;
      y *= inv;
    }
    return { x, y };
  }

  consumeClick() {
    if (!this.mouseClicked) return null;
    this.mouseClicked = false;
    return { x: this.mouseClickX, y: this.mouseClickY };
  }

  endFrame() {
    this.justPressed.clear();
    this.mouseClicked = false;
  }
}
