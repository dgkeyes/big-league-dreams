// Small DOM helpers for buttons and panels drawn over the 3D view.
import { sfx } from './sfx';

type Kids = (Node | string | null | undefined | false)[];

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', ...kids: Kids): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  for (const k of kids) if (k) e.append(k);
  return e;
}

export const div = (cls = '', ...kids: Kids) => h('div', cls, ...kids);

// A menu button. Fires on release, so a finger sliding across the screen doesn't press it.
export function btn(label: string | Node, onTap: () => void, cls = '') {
  const b = h('button', `btn ${cls}`, label);
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    if (b.disabled) return;
    sfx.tap();
    onTap();
  });
  b.addEventListener('pointerdown', (e) => e.stopPropagation());
  return b;
}

// A game button (SWING, DIVE, THROW). Fires the moment a finger touches it, because timing matters.
export function pad(label: string, onPress: () => void, cls = '') {
  const b = h('button', `pad ${cls}`, label);
  b.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (b.disabled) return;
    b.classList.add('down');
    onPress();
  });
  const up = () => b.classList.remove('down');
  b.addEventListener('pointerup', up);
  b.addEventListener('pointercancel', up);
  b.addEventListener('pointerleave', up);
  return b;
}

export function show(e: HTMLElement, on: boolean) {
  e.classList.toggle('hidden', !on);
}

export const money = (n: number) => `$${n}`;

export function pill(kind: 'cash' | 'token', text: string) {
  return div(`pill ${kind}`, div('pill-icon', kind === 'cash' ? '$' : '★'), h('span', '', text));
}

// A big word that pops in the middle of the screen, like HOME RUN!
export function banner(root: HTMLElement, text: string, sub = '', color = '#ffd23f', ms = 1600) {
  if (import.meta.env.DEV) ((window as unknown as { __log: string[] }).__log ??= []).push(`${text} ${sub}`.trim());
  const b = div('banner', h('div', 'banner-main', text), sub ? h('div', 'banner-sub', sub) : null);
  (b.firstChild as HTMLElement).style.color = color;
  // A new word replaces the last one, so they never pile up on top of each other.
  root.querySelectorAll('.banner').forEach((old) => {
    old.classList.add('out');
    setTimeout(() => old.remove(), 300);
  });
  root.appendChild(b);
  setTimeout(() => b.classList.add('out'), ms);
  setTimeout(() => b.remove(), ms + 400);
}

export function skillBars(skills: Record<string, number>, list: { id: string; name: string; color: string }[]) {
  return div(
    'skills',
    ...list.map((s) =>
      div(
        'skill',
        h('span', 'skill-name', s.name),
        div('skill-bar', Object.assign(div('skill-fill'), { style: `width:${skills[s.id]}%;background:${s.color}` })),
        h('span', 'skill-num', String(skills[s.id])),
      ),
    ),
  );
}

// Confetti made of DOM squares, for wins, level ups, and the quest.
export function confetti(root: HTMLElement, n = 70) {
  const colors = ['#ffd23f', '#ff5d8f', '#4dabf7', '#69db7c', '#b197fc', '#ff922b'];
  for (let i = 0; i < n; i++) {
    const c = div('confetti');
    c.style.left = `${Math.random() * 100}%`;
    c.style.background = colors[i % colors.length];
    c.style.animationDelay = `${Math.random() * 0.8}s`;
    c.style.animationDuration = `${2 + Math.random() * 1.5}s`;
    root.appendChild(c);
    setTimeout(() => c.remove(), 4000);
  }
}
