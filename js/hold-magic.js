/* Peripheral currents deliver real grains to an orbit centered on the contact. */
(function(root) {
  'use strict';
  const TAU = Math.PI * 2;
  const DEFAULT_COLORS = ['#83dbff', '#c4bdff', '#ddf6ff'];
  const SQUASH = .88;
  const TAIL_LENGTH_MULTIPLIER = 5.2;
  const ORIGINAL_TAIL_SAMPLES = 8;
  const TAIL_SAMPLE_STEP = .067 / ORIGINAL_TAIL_SAMPLES;
  const clamp = n => Math.max(0, Math.min(1, n));
  const smooth = n => { const t = clamp(n); return t * t * (3 - 2 * t); };
  const sample = (i, salt) => {
    const v = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
    return v - Math.floor(v);
  };

  class HoldMagic {
    constructor(createCanvas = () => document.createElement('canvas'), settings = {}) {
      this.createCanvas = createCanvas;
      this.width = this.height = 1;
      this.grains = [];
      this.configure(settings);
      this.reset();
    }

    configure(settings = {}) {
      const {
        holdParticleCount: count = 96, holdParticleSize: size = 100, holdParticleBrightness: brightness = 100,
        holdInflowSpeed: inflow = 100, holdRingRadius: ring = 100, holdPalette: colors = DEFAULT_COLORS,
        holdTailLength: length = 100, holdTailWidth: width = 100, holdTailOpacity: opacity = 20, holdTailFalloff: falloff = 100
      } = root.EffectSettings ? root.EffectSettings.normalize(settings) : settings;
      const paletteChanged = !this.colors || colors.length !== this.colors.length || colors.some((c,i) => c !== this.colors[i]);
      const rebuild = this.grains.length !== count || this.inflowSpeed !== inflow;
      const radiusChanged = this.ringScale !== ring / 100;
      if (paletteChanged) {
        this.colors = colors.slice();
        this.sprites = null;
      }
      if (paletteChanged || this.falloff !== falloff) {
        this.falloff = falloff;
        this.tailTints = this.colors.map(color => Array.from({ length: 256 }, (_, i) => {
          const alpha = Math.round(255 * (i / 255) ** (falloff / 100));
          return color + alpha.toString(16).padStart(2, '0');
        }));
      }
      this.inflowSpeed = inflow;
      this.sizeScale = size / 100;
      this.brightnessScale = brightness / 100;
      this.ringScale = ring / 100;
      this.tailMultiplier = TAIL_LENGTH_MULTIPLIER * length / 100;
      this.tailWidth = width / 100;
      this.tailOpacity = opacity / 100;
      if (rebuild) this.grains = this._createGrains(count, inflow / 100);
      else if (paletteChanged) this.grains.forEach((g, i) => { g.tint = i % this.colors.length; });
      if (this.mode && (rebuild || radiusChanged)) this._routes();
      if (this.alpha > 0) this._place();
    }

    _createGrains(count, speed) {
      // For slow currents start the last grains earlier, so all reach the ring
      // before the same three-second automatic appraisal.
      const emissionSeconds = Math.min(2.1, 3 - .16 - .73 / speed);
      return Array.from({ length: count }, (_, i) => {
        // Twelve broad streams distributed along the four edges. Individual
        // grains fan out from each stream and peel off into separate orbit slots.
        const lane = i * 5 % 12;
        const depth = sample(i, 2);
        return {
          seed: i + 311, side: lane % 4, tint: i % this.colors.length,
          along: (Math.floor(lane / 4) + .5 + (sample(i, 3) - .5) * .68) / 3,
          inset: .027 + sample(i, 4) * .10,
          born: .16 + (i + sample(i, 5) * .6) / count * emissionSeconds,
          flight: (.49 + sample(i, 6) * .24) / speed,
          slot: i * 2.39996323, speed: .45 + depth * .42,
          band: .87 + sample(i, 7) * .28, curl: (sample(lane, 8) - .5) * .47,
          size: .8 + depth * 1.35, brightness: .53 + depth * .43,
          head: {}, tailPath: [], tailCount: 0, tailLength: 0
        };
      });
    }

    reset() {
      this.mode = 'idle';
      this.age = this.alpha = this.attraction = this.returnProgress = 0;
      this.lastBirth = Infinity;
      this.x = this.width / 2;
      this.y = this.height / 2;
      this._routes();
      this._place();
    }

    resize(w, h) {
      if (!(w > 0 && h > 0) || !Number.isFinite(w + h)) return;
      this.x *= w / this.width;
      this.y *= h / this.height;
      this.width = w;
      this.height = h;
      this._routes();
      this._place();
    }

    _routes() {
      const w = this.width, h = this.height;
      this.ringRadius = Math.max(32, Math.min(62, Math.min(w, h) * .118)) * this.ringScale;
      for (const g of this.grains) {
        let sx = w * (g.side % 2 ? g.along : g.side === 0 ? g.inset : 1 - g.inset);
        let sy = h * (g.side % 2 === 0 ? g.along : g.side === 1 ? g.inset : 1 - g.inset);
        const dx = sx - this.x, dy = sy - this.y;
        // A finger near the border still draws power from a distance.
        if (Math.hypot(dx, dy) < this.ringRadius * 2.5) { sx = w - sx; sy = h - sy; }
        g.startAngle = Math.atan2((sy - this.y) / SQUASH, sx - this.x);
        g.distance = Math.hypot(sx - this.x, (sy - this.y) / SQUASH);
        g.turn = Math.atan2(Math.sin(g.slot - g.startAngle), Math.cos(g.slot - g.startAngle));
      }
    }

    _contact(frame) {
      if (frame.x !== this.x || frame.y !== this.y) {
        this.x = frame.x; this.y = frame.y;
        this._routes();
      }
      this.age = frame.age;
      this.alpha = 1;
    }

    seal(frame) {
      this._contact(frame);
      this.mode = 'sealed';
      this.lastBirth = this.age;
      this._place();
    }

    release(frame) {
      this.seal(frame);
      this.mode = 'return';
      this.returnProgress = 0;
    }

    step(seconds, frame, returnProgress = null) {
      if (!Number.isFinite(seconds) || seconds < 0) return;
      const dt = Math.min(seconds, .05);
      if (frame) {
        this._contact(frame);
        this.mode = 'held';
        this.lastBirth = Infinity;
        this.returnProgress = 0;
        this.attraction = smooth((this.age - .15) / .9);
      } else {
        if (this.mode === 'idle') return;
        this.age += dt;
        this.attraction = Math.max(0, this.attraction - dt * 3);
        if (this.mode === 'return') this.returnProgress = clamp(returnProgress ?? this.returnProgress);
        else if (this.mode !== 'sealed') {
          if (this.mode === 'held') this.lastBirth = this.age - dt;
          this.mode = 'fading';
          this.alpha = Math.max(0, this.alpha - dt * 3.8);
          if (!this.alpha) { this.mode = 'idle'; return; }
        }
      }
      this._place();
    }

    _sample(g, age, out) {
      const p = clamp((age - g.born) / g.flight);
      const landingTime = age - g.born - g.flight;
      const turnIn = smooth(p * p);
      // The last stretch matches the ring's angular and radial velocity.
      const angle = g.startAngle + g.turn * turnIn + g.curl * Math.sin(Math.PI * p) ** 2
        + g.speed * landingTime * turnIn;
      const ring = this.ringRadius * g.band * (1 + .025 * Math.sin(age * 1.9 + g.slot));
      const approach = smooth(p);
      const r = g.distance + (ring - g.distance) * approach;
      out.x = this.x + this.shiftX * approach + Math.cos(angle) * r;
      out.y = this.y + this.shiftY * approach + Math.sin(angle) * r * SQUASH;
    }

    _place() {
      const t = smooth(this.returnProgress);
      const dx = this.width / 2 - this.x, dy = this.height / 2 - this.y;
      const bend = Math.sin(Math.PI * t) * Math.min(.18, 64 / Math.max(1, Math.hypot(dx, dy)));
      this.shiftX = t * dx - dy * bend;
      this.shiftY = t * dy + dx * bend;
      this.arrived = 0;
      for (const g of this.grains) {
        const since = this.age - g.born;
        g.alpha = since > 0 && g.born <= this.lastBirth ? smooth(since / .15) * g.brightness : 0;
        if (!g.alpha) continue;
        const landed = since - g.flight;
        if (landed >= 0) this.arrived++;
        this._sample(g, this.age, g.head);
        g.trail = this.tailOpacity > 0 ? 1 - smooth(landed / .09) : 0;
        if (g.trail > 0) this._traceTail(g);
      }
    }

    _traceTail(g) {
      // Measure in screen space so accelerating and turning grains get the same
      // length multiplier. A newly born grain can only show the path already flown.
      const path = g.tailPath;
      path[0] = g.head;
      g.head.distance = 0;
      let length = 0, target = Infinity, count = 1;
      while (length < target) {
        const age = Math.max(g.born, this.age - count * TAIL_SAMPLE_STEP);
        const p = path[count] || (path[count] = {});
        this._sample(g, age, p);
        const prev = path[count - 1], dx = p.x - prev.x, dy = p.y - prev.y;
        const segment = Math.hypot(dx, dy);
        if (length + segment > target) {
          const fraction = (target - length) / segment;
          p.x = prev.x + dx * fraction;
          p.y = prev.y + dy * fraction;
        }
        length = Math.min(target, length + segment);
        p.distance = length;
        if (count === ORIGINAL_TAIL_SAMPLES) target = length * this.tailMultiplier;
        count++;
        if (age === g.born) break;
      }
      g.tailCount = count;
      g.tailLength = length;
    }

    point(q, kind) {
      if (this.attraction < .002 || kind === 'star') return null;
      const dx = q.x - this.x, dy = q.y - this.y;
      const distance = Math.hypot(dx, dy);
      const influence = smooth(1 - distance / Math.min(320, this.width * .7)) * this.attraction;
      if (influence < .002) return null;
      const angle = Math.atan2(dy, dx) + influence * .28;
      const reach = distance * (1 - influence * .28);
      return { x: this.x + Math.cos(angle) * reach, y: this.y + Math.sin(angle) * reach,
        brightness: 1 + influence * .5, scale: 1, alpha: 1 };
    }

    _textures() {
      if (this.sprites) return this.sprites;
      this.sprites = this.colors.map(color => {
        const c = this.createCanvas();
        c.width = c.height = 48;
        const ctx = c.getContext('2d'), glow = ctx.createRadialGradient(24, 24, 0, 24, 24, 24);
        glow.addColorStop(0, '#f4fcff'); glow.addColorStop(.12, color);
        glow.addColorStop(.27, color + 'a8'); glow.addColorStop(.53, color + '30');
        glow.addColorStop(1, color + '00');
        ctx.fillStyle = glow; ctx.fillRect(0, 0, 48, 48);
        return c;
      });
      return this.sprites;
    }

    _drawTail(ctx, g) {
      const path = g.tailPath, tip = g.tailCount - 1, tints = this.tailTints[g.tint];
      for (let i = 0; i < tip; i++) {
        const p = path[i], ahead = path[Math.max(0, i - 1)], behind = path[i + 1];
        const dx = ahead.x - behind.x, dy = ahead.y - behind.y;
        const fraction = 1 - p.distance / g.tailLength;
        const taper = this.tailWidth * g.size * .73 * fraction / Math.max(.01, Math.hypot(dx, dy));
        p.nx = -dy * taper;
        p.ny = dx * taper;
        p.color = tints[Math.round(255 * fraction)];
      }
      path[tip].nx = path[tip].ny = 0;
      path[tip].color = tints[0];

      // Each strip shares its cross-section and alpha with the next. Split at
      // bends so opacity follows distance travelled, including on a curling tail.
      for (let start = 0; start < tip;) {
        const a = path[start];
        let end = start + 1;
        while (end < tip) {
          const next = path[end + 1], span = next.distance - a.distance;
          if (span > g.tailLength * .25 || Math.hypot(next.x - a.x, next.y - a.y) < span * .99) break;
          end++;
        }
        const b = path[end];
        if (b.distance > a.distance) {
          const ramp = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
          ramp.addColorStop(0, a.color);
          ramp.addColorStop(1, b.color);
          ctx.fillStyle = ramp;
          ctx.beginPath();
          ctx.moveTo(a.x + a.nx, a.y + a.ny);
          for (let i = start + 1; i <= end; i++) ctx.lineTo(path[i].x + path[i].nx, path[i].y + path[i].ny);
          for (let i = end; i >= start; i--) ctx.lineTo(path[i].x - path[i].nx, path[i].y - path[i].ny);
          ctx.closePath();
          ctx.fill();
        }
        start = end;
      }
    }

    draw(ctx, opacity = 1) {
      const alpha = this.alpha * clamp(opacity);
      if (!ctx || alpha < .002) return;
      const glow = this._textures();
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const coreRadius = 15 + 20 * this.arrived / this.grains.length;
      ctx.globalAlpha = alpha * .22;
      ctx.drawImage(glow[0], this.x + this.shiftX - coreRadius, this.y + this.shiftY - coreRadius, coreRadius * 2, coreRadius * 2);
      for (const g of this.grains) {
        if (!g.alpha) continue;
        const light = alpha * g.alpha * this.brightnessScale;
        if (g.trail > .001 && g.tailLength > .01) {
          ctx.globalAlpha = this.tailOpacity * alpha * g.trail * (g.alpha / g.brightness);
          this._drawTail(ctx, g);
        }
        const radius = g.size * 3.5 * this.sizeScale;
        ctx.globalAlpha = light;
        ctx.drawImage(glow[g.tint], g.head.x - radius, g.head.y - radius, radius * 2, radius * 2);
      }
      ctx.restore();
    }

    captureTrails(settings = {}) {
      const brightness = this.alpha * this.brightnessScale;
      const holdParticles = this.grains.filter(g => brightness * g.alpha > .01).map(g => ({
        x: g.head.x, y: g.head.y, color: this.colors[g.tint], opacity: brightness * g.alpha, seed: g.seed
      }));
      return { width: this.width, height: this.height, time: this.age,
        settings: { ...settings, trailEnabled: true, trailOpacity: 100 }, holdParticles,
        strokes: [], opacity: () => 1 };
    }
  }

  root.HoldMagic = HoldMagic;
})(globalThis);
