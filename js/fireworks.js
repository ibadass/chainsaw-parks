// Full-screen fireworks show drawn on a transient canvas overlay.
import { playBang, playBoom, playCrackle, playLaunch, playWhistle } from './sound.js';

const MAX_PARTICLES = 6000;
const ROCKET_GRAVITY = 0.2;
// Full-screen flashes stay under 3 per second (WCAG 2.3.1, photosensitive epilepsy).
const SKY_FLASH_INTERVAL = 350;
const SHAKE_INTERVAL = 150;

const HUES = {
  red: { h: 2, s: 100, l: 58 },
  orange: { h: 26, s: 100, l: 58 },
  gold: { h: 44, s: 100, l: 62 },
  white: { h: 40, s: 30, l: 92 },
  blue: { h: 200, s: 100, l: 62 },
  cyan: { h: 182, s: 100, l: 60 },
  violet: { h: 275, s: 100, l: 68 },
  pink: { h: 322, s: 100, l: 66 },
  green: { h: 135, s: 100, l: 60 },
};
const PALETTES = [
  [HUES.red, HUES.orange, HUES.gold],
  [HUES.gold, HUES.white],
  [HUES.blue, HUES.violet, HUES.white],
  [HUES.pink, HUES.violet],
  [HUES.green, HUES.gold],
  [HUES.red, HUES.white],
  [HUES.blue, HUES.pink, HUES.gold],
  [HUES.cyan, HUES.white, HUES.pink],
];

const rand = (min, max) => min + Math.random() * (max - min);
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const hsla = (c, alpha, lightBoost = 0) => `hsla(${c.h},${c.s}%,${Math.min(c.l + lightBoost, 100)}%,${alpha})`;

/** Converts a hex colour to HSL, kept bright enough to glow on the dark overlay. */
function hexToHsl(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let s = 0;
  if (d) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  const saturation = Math.round(s * 100);
  if (saturation < 10) return HUES.white;
  return { h: Math.round(h * 60 + 360) % 360, s: saturation, l: Math.min(Math.max(Math.round(l * 100), 55), 75) };
}

const toPalette = (colors) => colors.map((color) => (typeof color === 'string' ? hexToHsl(color) : color));

// Pre-rendered radial glow per colour: much cheaper than shadowBlur and gives a real bloom.
const sprites = new Map();
function glowSprite(c) {
  const key = `${c.h}-${c.s}-${c.l}`;
  let sprite = sprites.get(key);
  if (!sprite) {
    sprite = document.createElement('canvas');
    sprite.width = sprite.height = 64;
    const g = sprite.getContext('2d');
    const gradient = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, `hsla(${c.h},${c.s}%,97%,1)`);
    gradient.addColorStop(0.12, hsla(c, 0.95, 12));
    gradient.addColorStop(0.35, hsla(c, 0.35));
    gradient.addColorStop(1, hsla(c, 0));
    g.fillStyle = gradient;
    g.fillRect(0, 0, 64, 64);
    sprites.set(key, sprite);
  }
  return sprite;
}

let show = null;
let lastShake = 0;

/** Shakes the page content (not the overlay), like a camera hit by a blast. */
export function shake(strength = 6, duration = 380) {
  const now = performance.now();
  if (now - lastShake < SHAKE_INTERVAL) return;
  lastShake = now;
  const frames = Array.from({ length: 8 }, (_, i) => {
    const k = strength * (1 - i / 8);
    return { transform: `translate(${rand(-k, k)}px, ${rand(-k, k)}px)` };
  });
  frames.push({ transform: 'translate(0, 0)' });
  for (const el of document.querySelectorAll('body > header, body > main, body > footer')) {
    el.animate(frames, { duration, easing: 'linear' });
  }
}

function createShow() {
  const veil = document.createElement('div');
  veil.setAttribute('aria-hidden', 'true');
  veil.style.cssText =
    'position:fixed;inset:0;z-index:999;pointer-events:none;opacity:0;transition:opacity 450ms ease;' +
    'background:radial-gradient(ellipse at 50% 35%, rgba(30,0,25,0.45), rgba(0,0,0,0.82));';

  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;z-index:1000;pointer-events:none;';

  // Sky flashes live on their own layer: drawn on the trail canvas they would never fully fade out.
  const sky = document.createElement('div');
  sky.setAttribute('aria-hidden', 'true');
  sky.style.cssText = 'position:fixed;inset:0;z-index:999;pointer-events:none;opacity:0;mix-blend-mode:screen;';

  document.body.append(veil, sky, canvas);
  requestAnimationFrame(() => {
    veil.style.opacity = '1';
  });

  const ctx = canvas.getContext('2d');
  const s = {
    veil,
    sky,
    canvas,
    ctx,
    width: 0,
    height: 0,
    rockets: [],
    particles: [],
    flashes: [],
    waves: [],
    lastSky: 0,
    timers: [],
    pending: 0,
    last: performance.now(),
    frame: 0,
    resize: null,
  };

  s.resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    s.width = window.innerWidth;
    s.height = window.innerHeight;
    canvas.width = Math.round(s.width * dpr);
    canvas.height = Math.round(s.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  s.resize();
  window.addEventListener('resize', s.resize);

  s.frame = requestAnimationFrame((now) => tick(s, now));
  return s;
}

function destroyShow(s) {
  cancelAnimationFrame(s.frame);
  window.removeEventListener('resize', s.resize);
  s.timers.forEach(clearTimeout);
  s.veil.style.opacity = '0';
  s.canvas.style.transition = 'opacity 450ms ease';
  s.canvas.style.opacity = '0';
  setTimeout(() => {
    s.veil.remove();
    s.sky.remove();
    s.canvas.remove();
  }, 500);
  if (show === s) show = null;
}

function schedule(s, delay, fn) {
  s.pending += 1;
  const id = setTimeout(() => {
    s.pending -= 1;
    if (show === s) fn();
  }, delay);
  s.timers.push(id);
}

function launchRocket(s, from, target, palette, type) {
  const height = Math.max(from.y - target.y, 80);
  const vy = -Math.sqrt(2 * ROCKET_GRAVITY * height);
  const flightFrames = -vy / ROCKET_GRAVITY;
  const whistle = Math.random() < 0.3;
  s.rockets.push({
    x: from.x,
    y: from.y,
    px: from.x,
    py: from.y,
    vx: (target.x - from.x) / flightFrames,
    vy,
    palette,
    type,
    whistle,
    age: 0,
  });
  if (whistle) playWhistle();
  else playLaunch();
}

function addParticle(s, p) {
  if (s.particles.length >= MAX_PARTICLES) return null;
  const particle = {
    px: p.x,
    py: p.y,
    life: 1,
    age: 0,
    friction: 0.975,
    gravity: 0.045,
    size: 2,
    glow: 0,
    decay: rand(0.01, 0.018),
    ...p,
  };
  s.particles.push(particle);
  return particle;
}

function addFlash(s, x, y, color, radius) {
  s.flashes.push({ x, y, color, radius, life: 1 });
}

function addWave(s, x, y, color, radius) {
  s.waves.push({ x, y, color, radius, r: 4, life: 1 });
}

function skyFlash(s, color, strength = 0.18) {
  const now = performance.now();
  if (now - s.lastSky < SKY_FLASH_INTERVAL) return;
  s.lastSky = now;
  s.sky.style.background = `radial-gradient(ellipse at 50% 30%, ${hsla(color, 1, 10)}, ${hsla(color, 0.4)})`;
  s.sky.animate([{ opacity: Math.min(strength, 0.22) }, { opacity: 0 }], { duration: 450, easing: 'ease-out' });
}

/** Radial burst helper: `count` stars thrown in every direction. */
function burst(s, x, y, count, { speed = [2, 7.5], colors, even = false, ...props }) {
  for (let i = 0; i < count; i++) {
    const angle = even ? (i / count) * Math.PI * 2 : Math.random() * Math.PI * 2;
    const v = rand(speed[0], speed[1]);
    addParticle(s, { x, y, vx: Math.cos(angle) * v, vy: Math.sin(angle) * v, color: pick(colors), ...props });
  }
}

/** Burst whose stars draw a shape (points on a unit outline). */
function shapeBurst(s, x, y, points, speed, color) {
  const rotation = rand(-0.3, 0.3);
  for (const [px, py] of points) {
    const rx = px * Math.cos(rotation) - py * Math.sin(rotation);
    const ry = px * Math.sin(rotation) + py * Math.cos(rotation);
    addParticle(s, {
      x,
      y,
      vx: rx * speed,
      vy: ry * speed,
      color,
      size: 2.6,
      glow: 5,
      friction: 0.955,
      gravity: 0.015,
      decay: 0.011,
    });
  }
}

const HEART = Array.from({ length: 70 }, (_, i) => {
  const t = (i / 70) * Math.PI * 2;
  return [
    (16 * Math.sin(t) ** 3) / 16,
    -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 16,
  ];
});
const STAR = Array.from({ length: 80 }, (_, i) => {
  // Walk the outline of a 5-pointed star.
  const segment = Math.floor(i / 8);
  const t = (i % 8) / 8;
  const corner = (k) => {
    const angle = -Math.PI / 2 + (k * Math.PI) / 5;
    const radius = k % 2 ? 0.45 : 1;
    return [Math.cos(angle) * radius, Math.sin(angle) * radius];
  };
  const [ax, ay] = corner(segment);
  const [bx, by] = corner(segment + 1);
  return [ax + (bx - ax) * t, ay + (by - ay) * t];
});

const EXPLOSIONS = {
  peony(s, x, y, palette, k) {
    burst(s, x, y, Math.round(170 * k), { speed: [2, 8 * Math.sqrt(k)], colors: palette, size: 2.2, glow: 4 });
  },
  chrysanthemum(s, x, y, palette, k) {
    burst(s, x, y, Math.round(110 * k), {
      speed: [3, 8 * Math.sqrt(k)],
      colors: palette,
      size: 2.2,
      glow: 4,
      decay: rand(0.009, 0.013),
      emit: { every: 2, color: HUES.gold },
    });
  },
  ring(s, x, y, palette, k) {
    const tilt = rand(0.35, 1);
    const rotation = Math.random() * Math.PI;
    const color = pick(palette);
    const count = Math.round(110 * k);
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const rx = Math.cos(angle) * 6.5 * Math.sqrt(k);
      const ry = Math.sin(angle) * 6.5 * Math.sqrt(k) * tilt;
      addParticle(s, {
        x,
        y,
        vx: rx * Math.cos(rotation) - ry * Math.sin(rotation),
        vy: rx * Math.sin(rotation) + ry * Math.cos(rotation),
        color,
        size: 2.6,
        glow: 5,
        decay: 0.012,
      });
    }
    burst(s, x, y, Math.round(40 * k), { speed: [0.5, 2.5], colors: [HUES.white], size: 2, glow: 4 });
  },
  double(s, x, y, palette, k) {
    burst(s, x, y, Math.round(150 * k), { speed: [4, 8.5 * Math.sqrt(k)], colors: [palette[0]], size: 2.2, glow: 4 });
    const inner = palette.length > 1 ? palette.at(-1) : HUES.white;
    burst(s, x, y, Math.round(70 * k), { speed: [3, 3], even: true, colors: [inner], size: 2.6, glow: 5, flicker: true });
  },
  kamuro(s, x, y, _palette, k) {
    burst(s, x, y, Math.round(170 * k), {
      speed: [1.5, 7 * Math.sqrt(k)],
      colors: [HUES.gold],
      size: 1.8,
      glow: 4,
      friction: 0.955,
      gravity: 0.055,
      decay: rand(0.004, 0.007),
      flicker: true,
      emit: { every: 3, color: HUES.gold },
    });
  },
  palm(s, x, y, palette, k) {
    const arms = 9;
    for (let i = 0; i < arms; i++) {
      const angle = (i / arms) * Math.PI * 2 + rand(-0.15, 0.15);
      const v = rand(6, 8) * Math.sqrt(k);
      addParticle(s, {
        x,
        y,
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v - 1,
        color: pick(palette),
        size: 4,
        glow: 7,
        friction: 0.965,
        gravity: 0.06,
        decay: 0.009,
        emit: { every: 1, color: HUES.gold, spread: 1.2 },
      });
    }
  },
  crossette(s, x, y, palette, k) {
    burst(s, x, y, 12, {
      speed: [4.5 * Math.sqrt(k), 5.5 * Math.sqrt(k)],
      even: true,
      colors: palette,
      size: 3,
      glow: 6,
      decay: 0.012,
      splitAt: rand(26, 34),
    });
  },
  multibreak(s, x, y, palette, k) {
    const colors = palette.length > 1 ? palette : [...palette, HUES.white];
    burst(s, x, y, 14, {
      speed: [5 * Math.sqrt(k), 6.5 * Math.sqrt(k)],
      even: true,
      colors: [HUES.white],
      size: 2.4,
      glow: 5,
      decay: 0.03,
      breakInto: colors,
    });
  },
  crackle(s, x, y, palette, k) {
    burst(s, x, y, Math.round(100 * k), {
      speed: [3, 7.5 * Math.sqrt(k)],
      colors: palette,
      size: 2.4,
      glow: 4,
      decay: rand(0.016, 0.022),
      crackle: true,
    });
  },
  strobe(s, x, y, palette, k) {
    burst(s, x, y, Math.round(140 * k), {
      speed: [1.5, 6 * Math.sqrt(k)],
      colors: [HUES.white, palette[0]],
      size: 2.4,
      glow: 5,
      friction: 0.96,
      gravity: 0.03,
      decay: rand(0.007, 0.01),
      strobe: true,
    });
  },
  heart(s, x, y, palette, k) {
    shapeBurst(s, x, y, HEART, 6 * Math.sqrt(k), pick([HUES.pink, HUES.red, palette[0]]));
  },
  star(s, x, y, palette, k) {
    shapeBurst(s, x, y, STAR, 6.5 * Math.sqrt(k), pick([HUES.gold, palette[0]]));
  },
  salute(s, x, y, _palette, k) {
    burst(s, x, y, Math.round(60 * k), { speed: [6, 10], colors: [HUES.white], size: 2, glow: 6, decay: 0.035 });
  },
};
const RANDOM_TYPES = ['peony', 'chrysanthemum', 'ring', 'double', 'palm', 'crossette', 'multibreak', 'crackle', 'strobe', 'heart', 'star', 'kamuro'];
const BIG_TYPES = new Set(['kamuro', 'palm', 'salute', 'multibreak']);

function explode(s, rocket) {
  const k = Math.min(Math.max(Math.min(s.width, s.height) / 700, 0.75), 1.5);
  const type = rocket.type ?? pick(RANDOM_TYPES);
  const big = BIG_TYPES.has(type);
  EXPLOSIONS[type](s, rocket.x, rocket.y, rocket.palette, k);
  addFlash(s, rocket.x, rocket.y, type === 'salute' ? HUES.white : rocket.palette[0], (big ? 380 : 280) * k);
  addWave(s, rocket.x, rocket.y, rocket.palette[0], (big ? 260 : 170) * k);
  skyFlash(s, type === 'salute' ? HUES.white : rocket.palette[0], big ? 0.22 : 0.12);
  if (type === 'salute') {
    playBang();
    shake(10);
  } else {
    playBoom(big ? 1 : 0.75);
    if (big) shake(5);
  }
  if (type === 'crackle' || type === 'kamuro') playCrackle();
}

function updateParticle(s, p, step) {
  p.px = p.x;
  p.py = p.y;
  const drag = p.friction ** step;
  p.vx *= drag;
  p.vy = p.vy * drag + p.gravity * step;
  p.x += p.vx * step;
  p.y += p.vy * step;
  p.life -= p.decay * step;
  p.age += step;

  if (p.emit && p.life > 0.15) {
    p.emitTimer = (p.emitTimer ?? 0) + step;
    if (p.emitTimer >= p.emit.every) {
      p.emitTimer = 0;
      const spread = p.emit.spread ?? 0.4;
      addParticle(s, {
        x: p.x,
        y: p.y,
        vx: p.vx * 0.2 + rand(-spread, spread),
        vy: p.vy * 0.2 + rand(-spread, spread),
        color: p.emit.color,
        size: 1.2,
        friction: 0.92,
        gravity: 0.04,
        decay: rand(0.03, 0.06),
        flicker: true,
      });
    }
  }

  // Crossette: each star splits into four crossing stars.
  if (p.splitAt && p.age >= p.splitAt) {
    const heading = Math.atan2(p.vy, p.vx);
    for (let j = 0; j < 4; j++) {
      const angle = heading + Math.PI / 4 + (j * Math.PI) / 2;
      addParticle(s, {
        x: p.x,
        y: p.y,
        vx: Math.cos(angle) * 3.2,
        vy: Math.sin(angle) * 3.2,
        color: p.color,
        size: 2.2,
        glow: 4,
        decay: 0.018,
        emit: { every: 2, color: HUES.gold },
      });
    }
    addFlash(s, p.x, p.y, p.color, 60);
    p.life = 0;
    return;
  }

  if (p.life > 0) return;

  if (p.breakInto) {
    burst(s, p.x, p.y, 28, { speed: [1, 3.5], colors: p.breakInto, size: 1.8, glow: 4, decay: rand(0.018, 0.026) });
    addFlash(s, p.x, p.y, p.breakInto[0], 90);
    playCrackle();
  }
  if (p.crackle) {
    burst(s, p.x, p.y, 4, { speed: [0.5, 2], colors: [HUES.white], size: 1.2, glow: 3, friction: 0.9, decay: rand(0.05, 0.09) });
  }
}

function drawParticle(ctx, p) {
  let alpha = p.life;
  if (p.strobe) alpha *= Math.random() < 0.45 ? 1 : 0.08;
  else if (p.flicker && Math.random() < 0.3) alpha *= 0.2;
  if (alpha <= 0.01) return;

  ctx.strokeStyle = hsla(p.color, alpha, 25 * p.life);
  ctx.lineWidth = p.size;
  ctx.beginPath();
  ctx.moveTo(p.px, p.py);
  ctx.lineTo(p.x, p.y);
  ctx.stroke();

  if (p.glow && alpha > 0.12) {
    const r = p.size * p.glow * (0.6 + 0.4 * p.life);
    ctx.globalAlpha = Math.min(alpha, 1) * 0.85;
    ctx.drawImage(glowSprite(p.color), p.x - r, p.y - r, r * 2, r * 2);
    ctx.globalAlpha = 1;
  }
}

function tick(s, now) {
  const step = Math.min((now - s.last) / 16.67, 3);
  s.last = now;
  const { ctx } = s;

  // Fade previous frame to transparent to leave light trails over the page.
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = `rgba(0,0,0,${Math.min(0.2 * step, 1)})`;
  ctx.fillRect(0, 0, s.width, s.height);
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';

  for (let i = s.flashes.length - 1; i >= 0; i--) {
    const f = s.flashes[i];
    const gradient = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.radius);
    gradient.addColorStop(0, hsla(f.color, 0.7 * f.life, 25));
    gradient.addColorStop(0.35, hsla(f.color, 0.22 * f.life));
    gradient.addColorStop(1, hsla(f.color, 0));
    ctx.fillStyle = gradient;
    ctx.fillRect(f.x - f.radius, f.y - f.radius, f.radius * 2, f.radius * 2);
    f.life -= 0.07 * step;
    if (f.life <= 0) s.flashes.splice(i, 1);
  }

  for (let i = s.waves.length - 1; i >= 0; i--) {
    const w = s.waves[i];
    w.r += (w.radius - w.r) * 0.14 * step;
    w.life -= 0.06 * step;
    ctx.strokeStyle = hsla(w.color, 0.45 * w.life, 30);
    ctx.lineWidth = 2.5 * w.life + 0.5;
    ctx.beginPath();
    ctx.arc(w.x, w.y, w.r, 0, Math.PI * 2);
    ctx.stroke();
    if (w.life <= 0) s.waves.splice(i, 1);
  }

  for (let i = s.rockets.length - 1; i >= 0; i--) {
    const r = s.rockets[i];
    r.px = r.x;
    r.py = r.y;
    r.age += step;
    // Whistlers wiggle on their way up.
    const wobble = r.whistle ? Math.sin(r.age * 0.6) * 1.2 : 0;
    r.x += (r.vx + wobble) * step;
    r.y += r.vy * step;
    r.vy += ROCKET_GRAVITY * step;

    ctx.strokeStyle = hsla(HUES.gold, 1, 25);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(r.px, r.py);
    ctx.lineTo(r.x, r.y);
    ctx.stroke();
    ctx.globalAlpha = 0.9;
    ctx.drawImage(glowSprite(HUES.orange), r.x - 14, r.y - 14, 28, 28);
    ctx.globalAlpha = 1;
    for (let j = 0; j < 2; j++) {
      addParticle(s, {
        x: r.x,
        y: r.y,
        vx: rand(-0.8, 0.8),
        vy: rand(0.5, 2),
        color: j ? HUES.orange : HUES.gold,
        size: 1.4,
        decay: rand(0.04, 0.07),
        friction: 0.9,
        flicker: true,
      });
    }

    if (r.vy >= -0.5) {
      s.rockets.splice(i, 1);
      explode(s, r);
    }
  }

  for (let i = s.particles.length - 1; i >= 0; i--) {
    const p = s.particles[i];
    updateParticle(s, p, step);
    if (p.life <= 0) {
      s.particles.splice(i, 1);
      continue;
    }
    drawParticle(ctx, p);
  }

  const idle = !s.rockets.length && !s.particles.length && !s.flashes.length && !s.waves.length && !s.pending;
  if (idle) destroyShow(s);
  else s.frame = requestAnimationFrame((t) => tick(s, t));
}

function glitterRain(s, count) {
  for (let i = 0; i < count; i++) {
    schedule(s, rand(0, 1400), () => {
      addParticle(s, {
        x: rand(0, s.width),
        y: rand(-20, s.height * 0.3),
        vx: rand(-0.3, 0.3),
        vy: rand(0.3, 1.2),
        color: pick([HUES.gold, HUES.white, HUES.gold]),
        size: 1.6,
        glow: 4,
        friction: 0.99,
        gravity: 0.008,
        decay: rand(0.005, 0.009),
        strobe: true,
      });
    });
  }
}

function showStamp({ title, subtitle }) {
  document.querySelector('.fx-stamp')?.remove();
  const stamp = document.createElement('div');
  stamp.className = 'fx-stamp';
  stamp.setAttribute('aria-hidden', 'true');
  const titleEl = document.createElement('span');
  titleEl.className = 'fx-stamp__title';
  titleEl.textContent = title;
  stamp.append(titleEl);
  if (subtitle) {
    const subtitleEl = document.createElement('span');
    subtitleEl.className = 'fx-stamp__subtitle';
    subtitleEl.textContent = subtitle;
    stamp.append(subtitleEl);
  }
  document.body.append(stamp);

  const at = (scale, rotate = -10) => `translate(-50%, -50%) rotate(${rotate}deg) scale(${scale})`;
  stamp
    .animate(
      [
        { transform: at(3.2, -4), opacity: 0 },
        { transform: at(0.9), opacity: 1, offset: 0.1 },
        { transform: at(1.04, -11), opacity: 1, offset: 0.15 },
        { transform: at(1), opacity: 1, offset: 0.2 },
        { transform: at(1), opacity: 1, offset: 0.8 },
        { transform: at(1.08), opacity: 0 },
      ],
      { duration: 2000, easing: 'ease-out', fill: 'forwards' },
    )
    .finished.then(() => stamp.remove(), () => stamp.remove());

  // Impact: sparks fly off the stamp edges when it lands.
  setTimeout(() => {
    const s = show;
    if (!s || !stamp.isConnected) return;
    const box = stamp.getBoundingClientRect();
    const cx = box.left + box.width / 2;
    const cy = box.top + box.height / 2;
    addWave(s, cx, cy, HUES.red, Math.max(box.width, box.height) * 0.9);
    addFlash(s, cx, cy, HUES.orange, Math.max(box.width, box.height));
    for (let i = 0; i < 90; i++) {
      const angle = Math.random() * Math.PI * 2;
      const v = rand(4, 11);
      addParticle(s, {
        x: cx + (Math.cos(angle) * box.width) / 2,
        y: cy + (Math.sin(angle) * box.height) / 2,
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v,
        color: pick([HUES.red, HUES.orange, HUES.gold, HUES.white]),
        size: 2,
        glow: 4,
        friction: 0.93,
        gravity: 0.08,
        decay: rand(0.02, 0.035),
      });
    }
    shake(8);
    playBang(0.6);
  }, 200);
}

/** Stops the current show right away (e.g. on Escape). */
export function stopFireworks() {
  document.querySelector('.fx-stamp')?.remove();
  if (show) destroyShow(show);
}

/**
 * Launches a full-screen fireworks show. Calling it again while a show is running adds more rockets.
 * @param {object} [options]
 * @param {{x: number, y: number}} [options.origin] Viewport point the first rocket starts from.
 * @param {string[]} [options.palette] Hex colours favoured for this show (e.g. a flag).
 * @param {string[][]} [options.palettes] Hex palettes for the other rockets (defaults to a rainbow set).
 * @param {number} [options.rockets] Rockets launched from the bottom of the screen.
 * @param {number} [options.duration] Time span over which they are launched, in ms.
 * @param {number} [options.finale] Rockets in the final volley.
 * @param {{title: string, subtitle?: string}} [options.stamp] Big stamp slammed in the middle of the screen.
 */
export function launchFireworks({
  origin,
  palette,
  palettes,
  rockets = 14,
  duration = 3200,
  finale = 7,
  stamp,
} = {}) {
  show ??= createShow();
  const s = show;
  const { width: w, height: h } = s;
  const featured = palette ? toPalette(palette) : null;
  const pool = palettes ? palettes.map(toPalette) : PALETTES;
  const nextPalette = () => (featured && Math.random() < 0.6 ? featured : pick(pool));
  const randomTarget = () => ({ x: rand(w * 0.1, w * 0.9), y: rand(h * 0.1, h * 0.45) });
  const fromBottom = () => ({ x: rand(w * 0.08, w * 0.92), y: h + 10 });

  if (stamp) showStamp(stamp);

  const start = origin ?? { x: w / 2, y: h };
  launchRocket(
    s,
    start,
    { x: start.x + rand(-60, 60), y: Math.min(rand(h * 0.15, h * 0.3), start.y - 120) },
    featured ?? pick(pool),
    'peony',
  );

  // Opening fan: a quick V of rockets from the bottom corners.
  schedule(s, 120, () => {
    launchRocket(s, { x: w * 0.1, y: h + 10 }, { x: w * 0.3, y: h * 0.22 }, nextPalette(), 'ring');
    launchRocket(s, { x: w * 0.9, y: h + 10 }, { x: w * 0.7, y: h * 0.22 }, nextPalette(), 'ring');
  });

  for (let i = 0; i < rockets; i++) {
    schedule(s, rand(250, Math.max(duration - 900, 400)), () => {
      launchRocket(s, fromBottom(), randomTarget(), nextPalette());
    });
  }

  // Grand finale: a volley bursting together, salutes, then a golden kamuro crown and falling glitter.
  const finaleAt = Math.max(duration - 600, 500);
  schedule(s, finaleAt, () => {
    for (let i = 0; i < finale; i++) {
      const x = (w * (i + 1)) / (finale + 1);
      launchRocket(s, { x, y: h + 10 }, { x: x + rand(-40, 40), y: rand(h * 0.12, h * 0.32) }, featured ?? pick(pool), pick(['peony', 'chrysanthemum', 'palm', 'strobe']));
    }
  });
  schedule(s, finaleAt + 350, () => {
    launchRocket(s, { x: w * 0.3, y: h + 10 }, { x: w * 0.25, y: h * 0.18 }, [HUES.white], 'salute');
    launchRocket(s, { x: w * 0.7, y: h + 10 }, { x: w * 0.75, y: h * 0.18 }, [HUES.white], 'salute');
  });
  schedule(s, finaleAt + 700, () => {
    launchRocket(s, { x: w / 2, y: h + 10 }, { x: w / 2, y: h * 0.15 }, [HUES.gold], 'kamuro');
  });
  schedule(s, finaleAt + 1700, () => glitterRain(s, Math.round(Math.min(w, 1600) / 6)));
}
