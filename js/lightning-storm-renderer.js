(function(root){
  'use strict';
  const cycleSeconds=4.4/1.5,hitTime=1.28,tau=Math.PI*2;
  const clamp=n=>Math.max(0,Math.min(1,n));
  const smooth=n=>{n=clamp(n);return n*n*(3-2*n);};
  function stateAt(t,strikeSeed,effects) {
    const stormTime=effects?.stormTime??t;
    const profile=effects?.profile||LightningRankEffects.forRank('SS');
    const strikeProfile=effects?.strikeProfile||profile;
    const age = stormTime % cycleSeconds;
    const since = effects?.impactAge??(age-hitTime);
    const cycle=strikeSeed+Math.floor(stormTime/cycleSeconds);
    const strokes=LightningDischarge.strikePhases(cycle,since).map((p,i)=>({...p,
      strength:strikeProfile.skyStrength*(i===0?1:i===1?strikeProfile.doubleGain:strikeProfile.tripleGain)}));
    const flash=Math.max(0,...strokes.map(p=>p.flash*p.strength));
    const afterglow=Math.max(0,...strokes.map(p=>p.afterglow*p.strength));
    const descending=strokes.some(p=>p.strength>.01 && p.upper>0 && p.impactAge<0);
    return {
      strokes, flash, afterglow, impactAge: since, profile, strikeProfile,
      charge: since < 0 ? 0.18 + 0.82 * smooth(age / hitTime) : 0.18 + 0.70 * Math.exp(-since * 4),
      name: profile.skyStrength<.01?'電流聚集':descending ? '金雷直落' : flash>.20 ? '雷核命中' : since<0 ? '雷核蓄能' : afterglow>0 ? '餘弧消散' : '雷核待機',
      value: t >= hitTime ? 999 : 900 + Math.min(98, Math.floor(99 * t / hitTime))
    };
  }

  function glow(g, x, y, rx, ry, color, alpha, middle = 0.36) {
    if (alpha < 0.002) return;
    g.save();
    g.translate(x, y);
    g.scale(rx, ry);
    const grad = g.createRadialGradient(0, 0, 0, 0, 0, 1);
    grad.addColorStop(0, 'rgba(' + color + ',' + alpha + ')');
    grad.addColorStop(0.44, 'rgba(' + color + ',' + alpha * middle + ')');
    grad.addColorStop(1, 'rgba(' + color + ',0)');
    g.fillStyle = grad;
    g.fillRect(-1, -1, 2, 2);
    g.restore();
  }

  function makeSky(width,height) {
    let air = document.createElement('canvas');
    air.width = Math.max(1, Math.round(width));
    air.height = Math.max(1, Math.round(height));
    const g = air.getContext('2d');
    const sky = g.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, '#111432');
    sky.addColorStop(0.46, '#0a1021');
    sky.addColorStop(1, '#080b17');
    g.fillStyle = sky;
    g.fillRect(0, 0, width, height);
    // Turbulent, backlit air frames the discharge without outlining the play area.
    for (let i = 0; i < 26; i++) {
      const x = width * (0.5 + 0.58 * Math.sin(i * 5.13));
      const y = height * (0.08 + 0.095 * Math.cos(i * 3.13 + x / width * 3));
      glow(g, x, y, width * (0.17 + 0.07 * Math.sin(i)), height * 0.12,
        i % 3 ? '58,54,108' : '85,91,152', 0.105);
    }
    return air;
  }
  function drawField(ctx,width,height,t,p,cycle,skyExposure) {
    const cx = width * 0.50, cy = height * 0.76;
    const unit = Math.min(width, height);
    const age = t % 2;
    const ambience=p.profile.skyLight;
    // Delayed patches conduct sideways through the air every two seconds.
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const local = (age - 0.21 * i - (side > 0 ? 0.09 : 0)) / 0.85;
        if (local <= 0 || local >= 1) continue;
        const x = cx + side * width * (0.16 + 0.145 * i + 0.04 * local);
        const y = cy - height * (0.17 + i * 0.055 + 0.045 * side);
        glow(ctx, x, y, width * 0.22, height * 0.12, '166,135,54', 0.15 * ambience * Math.sin(local * Math.PI) ** 2);
      }
    }
    glow(ctx, cx, cy, unit * 0.32, unit * 0.23, '208,147,34', (0.045 + p.charge * 0.075 + 0.16 * p.flash)*ambience);
    // Incoming lightning briefly lights up its source; the white exposure is anchored to the impact.
    const chargedSky = Math.max(0, p.charge - 0.46)*p.profile.skyStrength;
    if (chargedSky > 0 || p.flash > 0.008) {
      const fork = LightningDischarge.contact(width, height, cycle);
      glow(ctx, fork.x, 0, width * 0.67, height * 0.23, '246,188,68', (chargedSky * 0.24 + p.flash * 0.27) * skyExposure);
    }
    if (p.flash > 0.008) {
      glow(ctx, cx, cy, width * 0.9, height * 0.72, '255,248,218', 0.63 * p.flash * skyExposure, 0.45);
    }
    // Ion motes rise and brighten around the advancing leaders.
    for (let i = 0; i < 32; i++) {
      const travel = (i * 0.618034 + t * (0.045 + (i % 5) * 0.006)) % 1;
      const x = cx + unit * Math.sin(i * 34.71 + travel * 1.8) * (0.13 + travel * 0.44);
      const y = cy - height * travel * 0.8;
      const a = Math.sin(travel * Math.PI) * (0.10 + 0.22 * p.charge)*ambience;
      ctx.fillStyle = 'rgba(245,213,132,' + a + ')';
      ctx.beginPath();ctx.arc(x, y, i % 6 ? 0.66 : 1.15, 0, tau);ctx.fill();
    }
  }


  class LightningStormRenderer {
    constructor(seed=Math.floor(Math.random()*1048576)){
      this.seed=seed;this.sky=null;
      this.canvas=document.createElement('canvas');this.ctx=this.canvas.getContext('2d');
    }
    static stateAt(time,seed=0,effects){return stateAt(time,seed,effects);}
    layout(width,height){
      const h=Math.max(160,Math.min(height*.68,height-200));
      return {x:0,y:0,width,height:h,gatherY:h*.76};
    }
    draw(ctx,background,width,height,frame={}){
      const hostTime=frame.time??0,effects=frame.lightningEffects;
      const time=effects?.time??hostTime,box=frame.box||this.layout(width,height);
      const opacity=clamp(frame.opacity??1);
      if(!opacity)return true;
      const scale=Math.min(2,Math.max(1,ctx.getTransform().a));
      const pw=Math.round(width*scale),ph=Math.round(height*scale);
      if(this.canvas.width!==pw||this.canvas.height!==ph){
        this.canvas.width=pw;this.canvas.height=ph;
      }
      if(!this.sky||this.sky.width!==Math.round(width)||this.sky.height!==Math.round(height)){
        this.sky=makeSky(width,height);
      }
      const g=this.ctx,p=stateAt(hostTime,this.seed,effects);
      const cycle=this.seed+Math.floor((effects?.stormTime??hostTime)/cycleSeconds);
      g.setTransform(scale,0,0,scale,0,0);
      g.drawImage(this.sky,0,0,width,height);
      g.save();g.translate(box.x,box.y);
      drawField(g,box.width,box.height,time,p,cycle,LightningDischarge.strikeType(cycle)==='medium'?.58:1);
      LightningDischarge.draw(g,box.width,box.height,time,cycle,p);
      g.restore();
      ctx.save();ctx.globalAlpha=opacity;
      ctx.drawImage(this.canvas,0,0,width,height);ctx.restore();
      return true;
    }
    dispose(){this.canvas.width=1;this.canvas.height=1;this.sky=null;}
  }
  root.LightningStormRenderer=LightningStormRenderer;
})(globalThis);
