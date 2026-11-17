// Touch controls for moving around: a joystick on the left and drag-to-look on the right.
import { div } from './ui';

export class Joystick {
  readonly el = div('stick', div('stick-knob'));
  x = 0;
  // Positive is forward (up on the screen).
  y = 0;
  private id: number | null = null;
  private cx = 0;
  private cy = 0;

  constructor() {
    // Tests drive the newest joystick by setting __joy.x and __joy.y.
    if (import.meta.env.DEV) (window as unknown as { __joy: Joystick }).__joy = this;
    const knob = this.el.firstChild as HTMLElement;
    const R = 60;
    const move = (e: PointerEvent) => {
      if (e.pointerId !== this.id) return;
      let dx = e.clientX - this.cx;
      let dy = e.clientY - this.cy;
      const d = Math.hypot(dx, dy);
      if (d > R) {
        dx = (dx / d) * R;
        dy = (dy / d) * R;
      }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.x = dx / R;
      this.y = -dy / R;
    };
    const end = (e: PointerEvent) => {
      if (e.pointerId !== this.id) return;
      this.id = null;
      this.x = this.y = 0;
      knob.style.transform = '';
    };
    this.el.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.id = e.pointerId;
      this.el.setPointerCapture(e.pointerId);
      const r = this.el.getBoundingClientRect();
      this.cx = r.left + r.width / 2;
      this.cy = r.top + r.height / 2;
      move(e);
    });
    this.el.addEventListener('pointermove', move);
    this.el.addEventListener('pointerup', end);
    this.el.addEventListener('pointercancel', end);
  }

  get active() {
    return Math.hypot(this.x, this.y) > 0.1;
  }
}

// Dragging anywhere on `el` that isn't a button turns the view. Read and clear dx, dy each frame.
export class LookPad {
  dx = 0;
  dy = 0;
  // Game time of the last drag, so the camera only follows the ball when the player isn't looking around.
  lastDrag = -99;
  private id: number | null = null;
  private px = 0;
  private py = 0;

  constructor(el: HTMLElement, now: () => number) {
    el.addEventListener('pointerdown', (e) => {
      if (this.id !== null) return;
      this.id = e.pointerId;
      this.px = e.clientX;
      this.py = e.clientY;
    });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.id) return;
      this.dx += e.clientX - this.px;
      this.dy += e.clientY - this.py;
      this.px = e.clientX;
      this.py = e.clientY;
      this.lastDrag = now();
    });
    const end = (e: PointerEvent) => {
      if (e.pointerId === this.id) this.id = null;
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }

  take() {
    const d = { x: this.dx, y: this.dy };
    this.dx = this.dy = 0;
    return d;
  }
}
