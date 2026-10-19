/* A quiet portal: fixed pools orbit clockwise; touching only changes their speed. */
(function(root){
  'use strict';
  const TAU=Math.PI*2;
  const fraction=value=>value-Math.floor(value);
  const sample=(index,salt)=>fraction(Math.sin(index*127.1+salt*311.7)*43758.5453);
  class PortalScene {
    constructor(context,width,height,createCanvas=()=>document.createElement('canvas')) {
      this.ctx=context;
      this.pointer={id:null};
      this.motion=root.ManaConfig.portalMotion;
      this.idleSpeed=this.motion.idleSpeed;
      this.activeSpeed=this.motion.maxSpeed;
      this.mistSprites=[];
      const colors=['107,92,166','76,99,163','99,87,154'];
      // Irregular, translucent cloud textures are built once, never in the frame loop.
      for(let variant=0;variant<colors.length;variant++) {
        const canvas=createCanvas();canvas.width=canvas.height=160;
        const c=canvas.getContext('2d');
        for(let lobe=0;lobe<15;lobe++) {
          const angle=sample(lobe,variant+1)*TAU;
          const distance=Math.sqrt(sample(lobe,variant+5))*31;
          const x=80+Math.cos(angle)*distance,y=80+Math.sin(angle)*distance;
          const radius=25+sample(lobe,variant+9)*25;
          const g=c.createRadialGradient(x,y,0,x,y,radius);
          g.addColorStop(0,'rgba('+colors[variant]+',0.23)');
          g.addColorStop(0.32,'rgba('+colors[variant]+',0.14)');
          g.addColorStop(0.7,'rgba('+colors[variant]+',0.045)');
          g.addColorStop(1,'rgba('+colors[variant]+',0)');
          c.fillStyle=g;c.fillRect(0,0,160,160);
        }
        this.mistSprites.push(canvas);
      }
      // One continuous fog bank, distributed between the opening and the screen corners.
      this.mists=Array.from({length:72},(_,i)=>({
        band:((i*7)%18+0.5)/18,
        seed:i*2.3999632297,initialAngle:TAU*(i+sample(i,21)*0.6)/72,
        depth:(i%3+sample(i,26)*0.8)/3,
        angle:0,orbit:0.88+sample(i,22)*0.23,
        rate:this.motion.mistRateMin+sample(i,23)*(this.motion.mistRateMax-this.motion.mistRateMin),
        driftRate:0.12+sample(i,27)*0.27,excursion:i%4===0,
        size:0.20+sample(i,24)*0.12,alpha:0.25+sample(i,25)*0.12,
        tint:i%3,x:0,y:0,radius:0
      }));
      this.mistDrawOrder=this.mists.slice().sort((a,b)=>a.depth-b.depth);
      this.dots=Array.from({length:102},(_,i)=>{
        const depth=sample(i,36),outer=i>=54;
        return {
          outer,depth,orbitScale:outer?1.08+sample(i,37)*.30:1,
          seed:i*2.3999632297,initialAngle:TAU*((outer?i-54:i)+sample(i,31)*0.8)/(outer?48:54),
          angle:0,orbit:0.78+sample(i,32)*0.48,
          // Nearer dots are larger, clearer and faster, with an individual speed offset.
          rate:0.45+depth*.95+sample(i,33)*.18,
          size:0.65+depth*.8+sample(i,34)*.15,alpha:0.30+depth*.4+sample(i,35)*.08,
          x:0,y:0,radius:0
        };
      });
      this.dotDrawOrder=this.dots.slice().sort((a,b)=>a.depth-b.depth);
      this.sparkleConfig=root.ManaConfig.portalSparkles;
      this.sparkles=Array.from({length:this.sparkleConfig.maxCount},()=>({active:false,age:0,life:1,angle:0,orbit:1,size:8,rate:1,x:0,y:0}));
      this.sparkleSprite=createCanvas();this.sparkleSprite.width=this.sparkleSprite.height=128;
      const sc=this.sparkleSprite.getContext('2d');
      const glow=sc.createRadialGradient(64,64,0,64,64,60);
      glow.addColorStop(0,'rgba(208,198,255,0.25)');
      glow.addColorStop(.35,'rgba(161,150,234,0.12)');
      glow.addColorStop(1,'rgba(135,126,211,0)');
      sc.fillStyle=glow;sc.fillRect(0,0,128,128);
      sc.fillStyle='#f8f5ff';sc.beginPath();sc.moveTo(64,24);
      sc.quadraticCurveTo(66,60,92,64);sc.quadraticCurveTo(66,68,64,104);
      sc.quadraticCurveTo(62,68,36,64);sc.quadraticCurveTo(62,60,64,24);
      sc.closePath();sc.fill();
      this.time=0;this.phase=0;this.speed=this.idleSpeed;
      this.resize(width,height);this.reset();
    }
    resize(width,height) {
      this.width=Math.max(1,Number.isFinite(width)?width:1);
      this.height=Math.max(1,Number.isFinite(height)?height:1);
      this.cx=this.width/2;this.cy=this.height/2;
      this.radius=Math.min(this.width,this.height)*0.34;
      this.radius=Math.min(this.radius,260);
      this.radiusX=this.width*0.43;
      this.radiusY=this.height*0.44;
      const c=this.ctx;
      // The portal follows the viewport proportions, including the faint rim haze.
      this.background=c.createRadialGradient(0,0,0,0,0,1.6);
      this.background.addColorStop(0,'#070812');
      this.background.addColorStop(0.26,'#090a19');
      this.background.addColorStop(0.52,'#101128');
      this.background.addColorStop(0.78,'#17182f');
      this.background.addColorStop(1,'#1c1d37');
      this.haze=c.createRadialGradient(0,0,0.65,0,0,1.22);
      this.haze.addColorStop(0,'rgba(60,55,108,0)');
      this.haze.addColorStop(0.3,'rgba(60,55,108,0.025)');
      this.haze.addColorStop(0.56,'rgba(74,66,132,0.12)');
      this.haze.addColorStop(0.76,'rgba(62,67,122,0.045)');
      this.haze.addColorStop(1,'rgba(62,67,122,0)');
      this.positionPools();
    }
    reset() {
      this.pointer.id=null;this.time=0;this.phase=0;this.speed=this.idleSpeed;
      this.speedFrom=this.idleSpeed;this.speedElapsed=0;
      this.sparkleSequence=0;this.sparkleCountdown=.18;
      for(const q of this.sparkles)q.active=false;
      for(let i=0;i<this.mists.length;i++)this.mists[i].angle=this.mists[i].initialAngle;
      for(let i=0;i<this.dots.length;i++)this.dots[i].angle=this.dots[i].initialAngle;
      this.positionPools();
    }
    stepSparkles(dt) {
      const cfg=this.sparkleConfig;
      const power=Math.max(0,Math.min(1,(this.speed-this.idleSpeed)/Math.max(.001,this.activeSpeed-this.idleSpeed)));
      let count=0;
      for(const q of this.sparkles) {
        if(!q.active)continue;
        q.age+=dt;
        if(q.age>=q.life){q.active=false;continue;}
        q.angle+=(.035+power*.16)*q.rate*dt;
        q.x=this.cx+Math.cos(q.angle)*this.radiusX*q.orbit;
        q.y=this.cy+Math.sin(q.angle)*this.radiusY*q.orbit;
        count++;
      }
      this.sparkleCountdown-=dt;
      if(dt===0||this.sparkleCountdown>0)return;
      const interval=cfg.idleInterval+(cfg.activeInterval-cfg.idleInterval)*power;
      this.sparkleCountdown=interval*(.8+sample(this.sparkleSequence,47)*.4);
      if(count>=Math.round(cfg.idleLimit+(cfg.maxCount-cfg.idleLimit)*power))return;
      const q=this.sparkles.find(item=>!item.active);
      if(!q)return;
      // Reject crowded or clipped positions rather than deforming the ellipse near edges.
      for(let attempt=0;attempt<20;attempt++) {
        const n=++this.sparkleSequence,angle=sample(n,41)*TAU,orbit=.94+sample(n,42)*.40;
        const size=sample(n,43)>.94?cfg.rareSize:cfg.sizeMin+sample(n,44)*(cfg.sizeMax-cfg.sizeMin);
        const x=this.cx+Math.cos(angle)*this.radiusX*orbit,y=this.cy+Math.sin(angle)*this.radiusY*orbit;
        const margin=size*.7+5;
        if(x<margin||x>this.width-margin||y<margin||y>this.height-margin)continue;
        if(this.sparkles.some(s=>s.active&&Math.hypot(s.x-x,s.y-y)<48))continue;
        Object.assign(q,{active:true,age:0,life:cfg.lifeMin+sample(n,45)*(cfg.lifeMax-cfg.lifeMin),angle,orbit,size,
          rate:.8+sample(n,46)*.4,x,y});
        break;
      }
    }
    down(id,x,y,now) {
      if(id===null||id===undefined||this.pointer.id!==null)return false;
      this.pointer.id=id;this.speedFrom=this.speed;this.speedElapsed=0;return true;
    }
    move(id,x,y,now) {return this.pointer.id!==null&&this.pointer.id===id;}
    release(id) {
      if(this.pointer.id===null||(id!==undefined&&id!==this.pointer.id))return false;
      this.pointer.id=null;this.speedFrom=this.speed;this.speedElapsed=0;return true;
    }
    step(seconds) {
      const dt=Number.isFinite(seconds)?Math.max(0,Math.min(seconds,0.05)):0;
      const held=this.pointer.id!==null,target=held?this.activeSpeed:this.idleSpeed;
      const duration=held?this.motion.accelerationSeconds:this.motion.decelerationSeconds;
      this.speedElapsed+=dt;
      const progress=Math.min(1,this.speedElapsed/Math.max(0.01,duration));
      const ease=progress*progress*(3-2*progress);
      this.speed=progress===1?target:this.speedFrom+(target-this.speedFrom)*ease;
      this.time+=dt;this.phase=(this.phase+this.speed*dt)%TAU;
      for(let i=0;i<this.mists.length;i++) {
        const q=this.mists[i];
        const localFlow=1+Math.sin(this.time*q.driftRate+q.seed)*0.23+Math.sin(this.time*.11+q.seed*2)*0.09;
        q.angle=(q.angle+this.speed*q.rate*localFlow*dt)%TAU;
      }
      for(let i=0;i<this.dots.length;i++) {
        const q=this.dots[i];q.angle=(q.angle+this.speed*q.rate*dt)%TAU;
      }
      this.positionPools();
      this.stepSparkles(dt);
    }
    positionPools() {
      for(let i=0;i<this.mists.length;i++) {
        const q=this.mists[i];
        const drift=Math.sin(this.time*q.driftRate+q.seed)*0.45+Math.sin(this.time*q.driftRate*.63+q.seed*2)*0.25;
        const excursion=q.excursion?Math.pow(Math.max(0,Math.sin(this.time*.21+q.seed)),4)*0.7:0;
        const band=1+(q.orbit-1+this.motion.mistDrift*(drift+excursion))*0.35;
        q.radius=this.radius*band;
        const cos=Math.cos(q.angle),sin=Math.sin(q.angle);
        const blend=Math.max(0,Math.min(1,q.band+Math.sin(this.time*q.driftRate*.4+q.seed)*.045));
        // Larger ellipses pass outside the viewport; never bend the orbit to its corners.
        q.orbitScale=1+blend*.52;
        const rx=this.radiusX*q.orbitScale,ry=this.radiusY*q.orbitScale;
        q.x=this.cx+cos*rx*band;q.y=this.cy+sin*ry*band;
        q.tangent=Math.atan2(cos*ry,-sin*rx);
      }
      for(let i=0;i<this.dots.length;i++) {
        const q=this.dots[i];
        const band=1+(q.orbit-1+Math.sin(this.time*0.19+q.seed)*0.018)*0.35;
        q.radius=this.radius*band;
        q.x=this.cx+Math.cos(q.angle)*this.radiusX*band*q.orbitScale;
        q.y=this.cy+Math.sin(q.angle)*this.radiusY*band*q.orbitScale;
      }
    }
    draw(quality=null) {
      const c=this.ctx,low=quality&&quality.name==='LOW';
      c.save();c.globalCompositeOperation='source-over';c.globalAlpha=1;
      c.save();c.translate(this.cx,this.cy);c.scale(this.radiusX,this.radiusY);
      const left=-this.cx/this.radiusX,top=-this.cy/this.radiusY;
      c.fillStyle=this.background;c.fillRect(left,top,-left*2,-top*2);
      c.fillStyle=this.haze;c.fillRect(left,top,-left*2,-top*2);
      c.restore();
      // Source-over keeps overlapping fog soft and colored, even while spinning quickly.
      for(let i=0;i<this.mistDrawOrder.length;i++) {
        if(low&&i%3===2)continue;
        const q=this.mistDrawOrder[i],breath=1+Math.sin(this.time*q.driftRate+q.seed)*0.15;
        const size=this.radius*q.size*breath*(0.85+q.depth*.4)*(1.7+q.band*.35);
        const thickness=0.6+q.depth*.3+Math.sin(this.time*q.driftRate*.8+q.seed)*.08;
        const tangent=q.tangent;
        c.save();c.translate(q.x,q.y);c.rotate(tangent+Math.sin(this.time*q.driftRate*.7+q.seed)*0.38);
        c.globalAlpha=q.alpha*(0.65+q.depth*.6)*(1-q.band*.18)*(0.86+Math.sin(this.time*q.driftRate*.9+q.seed)*0.14);
        c.drawImage(this.mistSprites[q.tint],-size*1.35,-size*thickness,size*2.7,size*thickness*2);
        c.restore();
      }
      c.fillStyle='#f1f1fa';
      for(let i=0;i<this.dotDrawOrder.length;i++) {
        const q=this.dotDrawOrder[i];
        if(low&&i%3===2&&!q.outer)continue;
        c.globalAlpha=q.alpha*(0.86+Math.sin(this.time*0.55+q.seed)*0.14);
        c.beginPath();c.arc(q.x,q.y,q.size,0,TAU);c.fill();
      }
      for(const q of this.sparkles) {
        if(!q.active)continue;
        const t=q.age/q.life;
        const phase=t<.2?t/.2:Math.max(0,(1-t)/.8);
        const envelope=phase*phase*(3-2*phase);
        const edge=Math.max(0,Math.min(1,Math.min(q.x,this.width-q.x,q.y,this.height-q.y)/(q.size*.8)));
        const size=q.size*(.45+.55*envelope)*1.6;
        c.globalAlpha=.86*envelope*edge;
        c.drawImage(this.sparkleSprite,q.x-size/2,q.y-size/2,size,size);
      }
      c.restore();
    }
  }
  root.PortalScene=PortalScene;
})(globalThis);
