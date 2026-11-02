/* Finger-sized gathering field. The shared reveal flow owns readiness and timing. */
(function(root) {
  'use strict';
  const TAU = Math.PI * 2;
  const clamp = value => Math.max(0, Math.min(1, value));
  const smooth = value => { const t = clamp(value); return t * t * (3 - 2 * t); };
  const sample = (index, salt) => {
    const n = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;
    return n - Math.floor(n);
  };
  const COLORS = ['#8ceaff', '#b9b5ff', '#edfaff'];

  class HoldMagic {
    constructor(createCanvas = () => document.createElement('canvas')) {
      this.createCanvas = createCanvas;
      this.width = 1;
      this.height = 1;
      this.sprites = null;
      this.motes = Array.from({ length: 42 }, (_, i) => ({
        angle: sample(i, 1) * TAU,
        speed: .38 + sample(i, 2) * .72,
        radius: 32 + sample(i, 3) * 52,
        depth: sample(i, 4),
        size: 1 + sample(i, 5) * 1.8,
        appearAt: sample(i, 6) * .6,
        tint: i % 3
      }));
      this.wisps = Array.from({ length: 3 }, () =>
        Array.from({ length: 45 }, () => ({ x: 0, y: 0, speed: .5 })));
      this.poses = this.motes.map(() => ({ x: 0, y: 0, alpha: 0, size: 1 }));
      this.reset();
    }

    reset() {
      this.time = 0;
      this.age = 0;
      this.attraction = 0;
      this.alpha = 0;
      this.x = this.width / 2;
      this.y = this.height / 2;
      this.returning = false;
      this.returnProgress = 0;
      this._place();
    }

    resize(width, height) {
      if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return;
      this.x *= width / this.width;
      this.y *= height / this.height;
      this.width = width;
      this.height = height;
      this._place();
    }

    release(frame) {
      if (frame && Number.isFinite(frame.x) && Number.isFinite(frame.y)) {
        this.x = frame.x;
        this.y = frame.y;
        this.age = frame.age || this.age;
      }
      this.alpha = 1;
      this.returning = true;
      this.returnProgress = 0;
      this._place();
    }

    step(seconds, frame, returnProgress = null) {
      if (!Number.isFinite(seconds) || seconds <= 0) return;
      const dt = Math.min(seconds, .05);
      if (!frame && !this.returning && this.alpha === 0 && this.attraction === 0) return;
      this.time += dt;
      if (frame && Number.isFinite(frame.x) && Number.isFinite(frame.y)) {
        this.x = frame.x;
        this.y = frame.y;
        this.age = Math.max(0, frame.age);
        this.attraction = smooth((this.age - .35) / .85);
        this.alpha = 1;
        this.returning = false;
        this.returnProgress = 0;
      } else if (this.returning && Number.isFinite(returnProgress)) {
        this.returnProgress = clamp(returnProgress);
      } else {
        this.alpha = Math.max(0, this.alpha - dt * 3.2);
      }
      if (!frame) this.attraction = Math.max(0, this.attraction - dt * 3.2);
      this._place();
    }

    _center(layer = 0) {
      const t = this.returning ? smooth(this.returnProgress) : 0;
      const dx = this.width / 2 - this.x;
      const dy = this.height / 2 - this.y;
      const distance = Math.hypot(dx, dy);
      const bend = Math.sin(t * Math.PI) * Math.min(72, distance * .18) * (1 + layer * .24);
      const divisor = Math.max(1, distance);
      return {
        x: this.x + dx * t - dy / divisor * bend,
        y: this.y + dy * t + dx / divisor * bend,
        radius: 1 - t * .45,
        turn: t * 1.35
      };
    }

    _place() {
      const growth = smooth((this.age - .25) / .85);
      for (let strand = 0; strand < this.wisps.length; strand++) {
        const center = this._center(strand - 1);
        const phase = strand * TAU / 3 + this.time * (.45 + strand * .07) + center.turn;
        const points = this.wisps[strand];
        for (let i = 0; i < points.length; i++) {
          const u = i / (points.length - 1);
          const radius = (36 + (1 - u) * (45 + growth * 42) +
            Math.sin(u * 8 + this.time * .8 + strand) * 4) * center.radius;
          const angle = phase + u * (1.65 + growth * .4);
          points[i].x = center.x + Math.cos(angle) * radius;
          points[i].y = center.y + Math.sin(angle) * radius * .76 +
            Math.sin(u * 5 + strand + this.time * .5) * 3;
        }
      }
      const center = this._center();
      for (let i = 0; i < this.motes.length; i++) {
        const mote = this.motes[i];
        const pose = this.poses[i];
        const angle = mote.angle + this.time * mote.speed + center.turn;
        const breathe = Math.sin(this.time * .8 + mote.angle) * 4;
        const approach = 1 + (1 - growth) * (.45 + mote.depth * .45);
        const radius = (mote.radius + breathe) * center.radius * approach;
        pose.x = center.x + Math.cos(angle) * radius;
        pose.y = center.y + Math.sin(angle) * radius * (.6 + mote.depth * .3);
        pose.alpha = (.22 + mote.depth * .5) *
          (.65 + .35 * Math.sin(this.time * 1.3 + mote.angle) ** 2);
        pose.size = mote.size * (.8 + mote.depth * .4);
      }
    }

    point(q, kind) {
      if (this.attraction < .002 || kind === 'star') return null;
      const dx = q.x - this.x;
      const dy = q.y - this.y;
      const distance = Math.hypot(dx, dy);
      const radius = Math.min(260, this.width * .58);
      const influence = smooth(1 - distance / radius) * this.attraction;
      if (influence < .002) return null;
      const angle = Math.atan2(dy, dx) + influence * .28;
      const reach = distance * (1 - influence * .32);
      return {
        x: this.x + Math.cos(angle) * reach,
        y: this.y + Math.sin(angle) * reach,
        brightness: 1 + influence * .45,
        scale: 1,
        alpha: 1
      };
    }

    _textures() {
      if (this.sprites) return this.sprites;
      const glow = COLORS.map(color => {
        const canvas = this.createCanvas();
        canvas.width = canvas.height = 96;
        const ctx = canvas.getContext('2d');
        const gradient = ctx.createRadialGradient(48, 48, 0, 48, 48, 48);
        gradient.addColorStop(0, color);
        gradient.addColorStop(.12, color + 'b3');
        gradient.addColorStop(.42, color + '40');
        gradient.addColorStop(1, color + '00');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 96, 96);
        return canvas;
      });
      const pulse = this.createCanvas();
      pulse.width = pulse.height = 192;
      const ctx = pulse.getContext('2d');
      const gradient = ctx.createRadialGradient(96, 96, 0, 96, 96, 96);
      gradient.addColorStop(0, '#a5ecff00');
      gradient.addColorStop(.53, '#a5ecff00');
      gradient.addColorStop(.7, '#a5ecff09');
      gradient.addColorStop(.82, '#c9f7ff65');
      gradient.addColorStop(.91, '#a5ecff12');
      gradient.addColorStop(1, '#a5ecff00');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 192, 192);
      this.sprites = { glow, pulse };
      return this.sprites;
    }

    draw(ctx, opacity = 1) {
      const alpha = this.alpha * clamp(opacity);
      if (!ctx || alpha < .002) return;
      const sprites = this._textures();
      const gathered = smooth((this.age - .3) / .75);
      const center = this._center();
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = alpha * (.12 + .13 * gathered);
      const halo = (29 + gathered * 22) * center.radius;
      ctx.drawImage(sprites.glow[0], center.x - halo, center.y - halo, halo * 2, halo * 2);

      // Overlapping soft stamps keep a mist body while broken narrow glints reveal flow.
      for (let strand = 0; strand < this.wisps.length; strand++) {
        const points = this.wisps[strand];
        for (let i = 0; i < points.length; i++) {
          const u = i / (points.length - 1);
          const envelope = Math.sin(u * Math.PI) ** .8;
          const width = (7 + Math.sin(u * Math.PI) * 7) * center.radius;
          ctx.globalAlpha = alpha * gathered * envelope * .065;
          ctx.drawImage(sprites.glow[strand], points[i].x - width, points[i].y - width, width * 2, width * 2);
        }
        const start = Math.floor(((this.time * (.34 + strand * .055) + strand * .29) % 1) * 32);
        ctx.lineWidth = .6;
        ctx.strokeStyle = COLORS[strand];
        ctx.globalAlpha = alpha * gathered * .3;
        ctx.beginPath();
        ctx.moveTo(points[start].x, points[start].y);
        for (let i = start + 1; i < start + 8; i++) ctx.lineTo(points[i].x, points[i].y);
        ctx.stroke();
      }

      for (let i = 0; i < this.poses.length; i++) {
        const p = this.poses[i];
        const mote = this.motes[i];
        const appear = smooth((gathered - mote.appearAt) / .4);
        ctx.globalAlpha = alpha * p.alpha * appear;
        const radius = p.size * 3.2;
        ctx.drawImage(sprites.glow[mote.tint], p.x - radius, p.y - radius, radius * 2, radius * 2);
        ctx.globalAlpha *= .8;
        ctx.fillStyle = COLORS[mote.tint];
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * .42, 0, TAU);
        ctx.fill();
      }

      const pulseAge = this.age - 1.2;
      if (!this.returning && pulseAge >= 0 && pulseAge < .7) {
        const phase = pulseAge / .7;
        const size = 50 + smooth(phase) * 80;
        ctx.globalAlpha = alpha * Math.sin(Math.PI * phase) * .64;
        ctx.drawImage(sprites.pulse, center.x - size, center.y - size, size * 2, size * 2);
      }
      ctx.restore();
    }

    captureTrails(settings = {}) {
      const strokes = this.wisps.map((points, index) => ({
        points: points.map(p => ({ x: p.x, y: p.y, speed: .5 })),
        seed: 311 + index,
        color: COLORS[index],
        released: null
      }));
      return {
        width: this.width,
        height: this.height,
        time: this.time,
        settings: { ...settings, trailEnabled: true, trailOpacity: 100 },
        strokes,
        opacity: () => 1
      };
    }
  }

  root.HoldMagic = HoldMagic;
})(globalThis);