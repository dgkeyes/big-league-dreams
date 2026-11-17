// The one WebGL renderer, the main loop, and switching between screens.
import * as THREE from 'three';
import { clock } from './clock';

export interface Screen {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  // The screen's buttons and panels, laid over the 3D view.
  ui: HTMLElement;
  // Seconds of game time since the last frame.
  update?(dt: number): void;
  dispose?(): void;
}

type Maker = (arg?: unknown) => Screen;
const makers = new Map<string, Maker>();
export function register(name: string, make: Maker) {
  makers.set(name, make);
}

let renderer: THREE.WebGLRenderer;
let uiRoot: HTMLElement;
let current: Screen | null = null;
let currentName = '';

export function screenName() {
  return currentName;
}

export function go(name: string, arg?: unknown) {
  const make = makers.get(name);
  if (!make) throw new Error(`No screen ${name}`);
  clock.reset();
  if (current) {
    current.dispose?.();
    current.ui.remove();
    // Free the old screen's GPU buffers. Shared shapes just upload again if a later screen draws them.
    current.scene.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
  }
  currentName = name;
  current = make(arg);
  uiRoot.appendChild(current.ui);
  resize();
}

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h);
  if (current) {
    current.camera.aspect = w / h;
    current.camera.updateProjectionMatrix();
  }
}

function frame(dt: number) {
  clock.tick(dt);
  current?.update?.(dt * clock.scale);
}

function render() {
  if (current) renderer.render(current.scene, current.camera);
}

export function start(first: string) {
  // iPads are fast enough at about 1.5x; full Retina would cost a lot of battery for little gain.
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  document.getElementById('game')!.appendChild(renderer.domElement);
  uiRoot = document.getElementById('ui')!;
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 300));

  // ?manual stops the real-time loop so tests can step the game with __step.
  const manual = import.meta.env.DEV && new URLSearchParams(location.search).has('manual');
  if (import.meta.env.DEV) {
    Object.assign(window, {
      __clock: clock,
      __go: go,
      __step: async (sec: number, fps = 30) => {
        const n = Math.round(sec * fps);
        for (let i = 0; i < n; i++) {
          frame(1 / fps);
          // Let awaiting scripts run between frames, like they would in real time.
          await new Promise((r) => setTimeout(r, 0));
        }
        render();
      },
      __render: render,
      __renderer: renderer,
    });
  }

  go(first);
  let last = performance.now();
  const loop = (t: number) => {
    const dt = Math.min(0.05, (t - last) / 1000);
    last = t;
    if (!manual) {
      frame(dt);
      render();
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
