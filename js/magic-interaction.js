/* Pure simulation: gestures never read or change a certification result. */
(function (root) {
  'use strict';
  const TAU = Math.PI * 2;
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  class MagicField {
    constructor(config, width, height, random = Math.random) {
      this.config = config;
      this.width = width; this.height = height;
      this.pointer = { id:null, x:0, y:0, vx:0, vy:0, speed:0, strength:0,
        lastTime:0, angle:0, hasDirection:false, turn:0, still:0 };
      this.particles = Array.from({length:config.particles}, (_,i) => ({
        seed:random()*TAU, radial:Math.sqrt(random()), depth:0.4+random()*0.6,
        kind:i<config.particles-42 ? 0 : i<config.particles-6 ? 1 : 2,
        tint:i%3, x:0, y:0, vx:0, vy:0, px:0, py:0, gx:0,gy:0,gvx:0,gvy:0
      }));
      this.trails = Array.from({length:config.trails}, () => ({
        x:0,y:0,vx:0,vy:0,life:0,width:0,stroke:0,gx:0,gy:0,gvx:0,gvy:0
      }));
      this.reset();
    }
    reset() {
      const p=this.pointer;
      p.id=null; p.x=this.width/2; p.y=this.height/2;
      p.vx=p.vy=p.speed=p.strength=p.lastTime=p.angle=p.turn=p.still=0; p.hasDirection=false;
      this.time=0; this.trailHead=0; this.stroke=0; this.emission=0; this.gathering=false;
      this.trailBudget=0;this.trailX=p.x;this.trailY=p.y;
      for(const t of this.trails) t.life=0;
      for(const q of this.particles) {
        const radius=q.radial*Math.min(this.width*0.47,230);
        q.x=this.width/2+Math.cos(q.seed)*radius;
        q.y=this.height/2+Math.sin(q.seed)*radius*1.18;
        q.px=q.x; q.py=q.y;
        q.vx=-Math.sin(q.seed)*12*q.depth; q.vy=Math.cos(q.seed)*12*q.depth;
      }
    }
    resize(width,height) {
      const sx=width/this.width, sy=height/this.height;
      for(const q of this.particles) { q.x*=sx;q.px*=sx;q.y*=sy;q.py*=sy;q.vx*=sx;q.vy*=sy;q.gx*=sx;q.gy*=sy;q.gvx*=sx;q.gvy*=sy; }
      for(const t of this.trails) { t.x*=sx;t.y*=sy;t.vx*=sx;t.vy*=sy;t.gx*=sx;t.gy*=sy;t.gvx*=sx;t.gvy*=sy; }
      this.pointer.x*=sx;this.pointer.y*=sy;
      this.trailX*=sx;this.trailY*=sy;
      this.width=width;this.height=height;
      this.release(); // A changed coordinate system must not produce a fling.
    }
    down(id,x,y,now) {
      if(this.gathering || this.pointer.id!==null || !Number.isFinite(x+y+now)) return false;
      const p=this.pointer;
      p.id=id;p.x=clamp(x,0,this.width);p.y=clamp(y,0,this.height);
      p.vx=p.vy=p.speed=p.turn=p.still=0;p.hasDirection=false;p.lastTime=now;
      this.stroke++;this.emission=0;
      this.trailBudget=0;this.trailX=p.x;this.trailY=p.y;
      this.emit(p.x,p.y,0,0,18);
      return true;
    }
    move(id,x,y,now) {
      const p=this.pointer;
      if(id!==p.id || p.id===null || this.gathering || !Number.isFinite(x+y+now)) return false;
      x=clamp(x,0,this.width);y=clamp(y,0,this.height);
      const dx=x-p.x,dy=y-p.y, distance=Math.hypot(dx,dy);
      const elapsed=clamp((now-p.lastTime)/1000,0,0.1);
      const dt=clamp(elapsed,0.008,0.1);
      this.trailBudget=Math.min(14,this.trailBudget+elapsed*144);
      const speed=Math.min(this.config.maxSpeed,distance/dt);
      if(distance>1.5) {
        const angle=Math.atan2(dy,dx);
        if(p.hasDirection) {
          const delta=Math.atan2(Math.sin(angle-p.angle),Math.cos(angle-p.angle));
          // Ignore near-instant reversals: irregular circles count, zigzags do not become a vortex.
          const turn=Math.abs(delta)<1.8 ? clamp(delta/dt,-7,7) : 0;
          p.turn=p.turn*0.75+turn*0.25;
        }
        p.angle=angle;p.hasDirection=true;p.still=0;
        p.vx=p.vx*0.3+dx/distance*speed*0.7;
        p.vy=p.vy*0.3+dy/distance*speed*0.7;
        p.speed=Math.hypot(p.vx,p.vy);
        // Limit emission by elapsed time, not pointer event frequency (60 / 120 Hz phones).
        const trailDistance=Math.hypot(x-this.trailX,y-this.trailY);
        const samples=Math.min(Math.floor(this.trailBudget),Math.max(1,Math.ceil(trailDistance/9)));
        for(let i=1;i<=samples;i++) {
          const k=i/samples;
          this.emit(this.trailX+(x-this.trailX)*k,this.trailY+(y-this.trailY)*k,p.vx*0.18,p.vy*0.18,22-speed*0.009);
        }
        if(samples) {this.trailBudget-=samples;this.trailX=x;this.trailY=y;}
      }
      p.x=x;p.y=y;p.lastTime=now;
      return true;
    }
    release(id) {
      if(id!==undefined && id!==this.pointer.id) return false;
      this.pointer.id=null;
      return true; // Momentum and the fading field survive a lifted finger.
    }
    takeControl() {
      this.release();this.pointer.strength=0;this.gathering=true;
      for(const q of this.particles) this.capture(q);
      for(const t of this.trails) this.capture(t);
    }
    capture(q) { q.gx=q.x-this.width/2;q.gy=q.y-this.height/2;q.gvx=q.vx;q.gvy=q.vy; }
    gatherPoint(q,progress,dt) {
      if(progress<=0)return; // Preserve the exact takeover pose and velocity during the pause.
      const p=clamp(progress,0,1),ease=p*p*(3-2*p), radius=1-ease;
      const angle=ease*4.5,c=Math.cos(angle),s=Math.sin(angle);
      const drift=Math.sin(p*Math.PI)*(1-p)*0.14;
      const x=this.width/2+(q.gx*c-q.gy*s)*radius+q.gvx*drift;
      const y=this.height/2+(q.gx*s+q.gy*c)*radius+q.gvy*drift;
      q.vx=(x-q.x)/dt;q.vy=(y-q.y)/dt;q.x=x;q.y=y;
    }
    emit(x,y,vx,vy,width) {
      const t=this.trails[this.trailHead];
      this.trailHead=(this.trailHead+1)%this.trails.length;
      t.x=x;t.y=y;t.vx=vx;t.vy=vy;t.width=width;
      t.life=this.config.trailLife;t.stroke=this.stroke;
    }
    step(seconds, gather=0) {
      const dt=clamp(seconds,0,0.033);
      if(!dt) return;
      this.time+=dt;
      const p=this.pointer, held=p.id!==null && !this.gathering;
      p.strength+=(Number(held)-p.strength)*(1-Math.exp(-dt*(held?11:3.8)));
      p.vx*=Math.exp(-dt*4);p.vy*=Math.exp(-dt*4);
      p.speed=Math.hypot(p.vx,p.vy);p.turn*=Math.exp(-dt*1.5);
      p.still=held && p.speed<45 ? Math.min(1,p.still+dt) : Math.max(0,p.still-dt*3);
      if(held && p.speed<70) {
        this.emission+=dt;
        if(this.emission>=0.035) {
          this.emission%=0.035;
          this.emit(p.x+Math.sin(this.time*3)*3,p.y+Math.cos(this.time*4)*3,p.vx*0.12,p.vy*0.12,18+p.still*9);
        }
      }
      const cx=this.width/2,cy=this.height/2, radius=Math.min(this.config.fieldRadius,this.width*0.58);
      for(const q of this.particles) {
        q.px=q.x;q.py=q.y;
        if(this.gathering) { this.gatherPoint(q,gather,dt);continue; }
        let ax=0,ay=0;
        {
          // Independent drifting home positions give elasticity and life without pointer input.
          const a=q.seed+this.time*(0.05+q.depth*0.06);
          const r=q.radial*Math.min(this.width*0.47,230);
          const homeX=cx+Math.cos(a)*r+Math.sin(this.time*0.9+q.seed)*14;
          const homeY=cy+Math.sin(a)*r*1.18+Math.cos(this.time*0.65+q.seed)*16;
          ax=(homeX-q.x)*0.55;ay=(homeY-q.y)*0.55;
          const dx=p.x-q.x,dy=p.y-q.y,d=Math.max(5,Math.hypot(dx,dy));
          const near=Math.exp(-d/radius), mid=Math.exp(-Math.pow((d-radius*0.5)/(radius*0.45),2));
          const pull=(40+near*250+p.still*near*150)*p.strength;
          const swirl=(65+Math.abs(p.turn)*48)*mid*p.strength*(p.turn< -0.2?-1:1);
          ax+=dx/d*pull-dy/d*swirl+p.vx*near*p.strength*2;
          ay+=dy/d*pull+dx/d*swirl+p.vy*near*p.strength*2;
          // A soft inner shell prevents all particles collapsing onto the pointer.
          if(d<15) {ax-=dx/d*(15-d)*22*p.strength;ay-=dy/d*(15-d)*22*p.strength;}
        }
        const damping=Math.exp(-dt*(this.gathering?8:1.15+q.depth*0.4));
        const response=this.gathering || q.kind===0 ? 1 : q.kind===1 ? 0.72 : 0.22;
        q.vx=(q.vx+ax*dt*response)*damping;q.vy=(q.vy+ay*dt*response)*damping;
        const speed=Math.hypot(q.vx,q.vy),limit=this.config.maxSpeed;
        if(speed>limit){q.vx*=limit/speed;q.vy*=limit/speed;}
        q.x+=q.vx*dt;q.y+=q.vy*dt;
        if(q.x< -40 || q.x>this.width+40){q.x=clamp(q.x,-40,this.width+40);q.vx*=-0.45;}
        if(q.y< -40 || q.y>this.height+40){q.y=clamp(q.y,-40,this.height+40);q.vy*=-0.45;}
      }
      for(const t of this.trails) {
        if(t.life<=0) continue;
        if(this.gathering) { this.gatherPoint(t,gather,dt);continue; }
        t.life=Math.max(0,t.life-dt);
        t.vx*=Math.exp(-dt*2.5);t.vy*=Math.exp(-dt*2.5);
        t.x+=t.vx*dt+Math.sin(this.time*2+t.stroke)*dt*5;
        t.y+=t.vy*dt-dt*6;
      }
    }
  }
  root.MagicField=MagicField;
})(globalThis);
