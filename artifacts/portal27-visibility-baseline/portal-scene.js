/* The approved ribbon preview's quiet backdrop; touch only changes orbit speed. */
(function(root){
  'use strict';
  const TAU=Math.PI*2;
  const fraction=value=>value-Math.floor(value);
  const sample=(index,salt)=>fraction(Math.sin(index*127.1+salt*311.7)*43758.5453);
  const REFERENCE_WIDTH=390,REFERENCE_HEIGHT=600;
  const rgb=hex=>[1,3,5].map(offset=>parseInt(hex.slice(offset,offset+2),16)).join(',');
  const rgba=(color,alpha)=>'rgba('+color+','+Math.min(1,Math.max(0,alpha))+')';
  class PortalScene {
    constructor(context,width,height,createCanvas=()=>document.createElement('canvas'),settings={}) {
      this.ctx=context;
      this.pointer={id:null};
      this.settings=root.EffectSettings.normalize(settings);
      const v=this.settings;
      this.motion={...root.ManaConfig.portalMotion,idleSpeed:TAU/v.idleSeconds,maxSpeed:TAU/v.activeSeconds,
        accelerationSeconds:v.acceleration,decelerationSeconds:v.deceleration,
        mistDrift:root.ManaConfig.portalMotion.mistDrift*v.mistDrift/100};
      this.idleSpeed=this.motion.idleSpeed;
      this.activeSpeed=this.motion.maxSpeed;
      this.mistColors=[v.mistColor1,v.mistColor2,v.mistColor3].map(rgb);
      // Use the preview's actual haze/point formulas, not an approximate sprite bank.
      // All positions are authored in its 390 x 600 space, then scaled with the screen.
      this.mists=Array.from({length:v.mistEnabled?v.mistCount:0},(_,i)=>({
        seed:i,initialAngle:i/v.mistCount*TAU,angle:0,
        rate:.025+sample(i,1)*.025+(sample(i,1)-.5)*.025*(v.mistDrift/100-1),
        size:(25+sample(i,3)*40)*(v.mistSize/100),
        alpha:(.04+sample(i,2)*.07)*(v.mistOpacity/100),
        tint:i%3,x:0,y:0,referenceX:0,referenceY:0,radius:0,orbitScale:1
      }));
      this.mistDrawOrder=this.mists;
      const depthFactor=v.dotDepth<=100?.1+.9*v.dotDepth/100:v.dotDepth/100;
      this.dots=Array.from({length:v.dotEnabled?v.dotCount:0},(_,i)=>{
        const depth=v.dotDepth===100?sample(i,4):Math.max(0,Math.min(1,.5+(sample(i,4)-.5)*depthFactor));
        return {
          depth,seed:i,initialAngle:i/v.dotCount*TAU,angle:0,
          orbitScale:.92+sample(i,5)*.25,
          rate:(.02+depth*.04)*(v.dotSpeed/100),
          size:(.45+sample(i,6)*.5+(sample(i,6)-.5)*.5*(depthFactor-1))*(v.dotSize/100),
          alpha:(.18+sample(i,7)*.35+(sample(i,7)-.5)*.35*(depthFactor-1))*(v.dotOpacity/100),
          x:0,y:0,referenceX:0,referenceY:0,radius:0
        };
      });
      this.dotDrawOrder=this.dots;
      const base=root.ManaConfig.portalSparkles;
      this.sparkleConfig={...base,idleLimit:Math.ceil(base.idleLimit*v.starIdle/100),maxCount:Math.ceil(base.maxCount*v.starHeld/100),
        lifeMin:base.lifeMin*(v.starDuration/1.1),lifeMax:base.lifeMax*(v.starDuration/1.1),
        idleInterval:base.idleInterval/(v.starIdle/100),activeInterval:base.activeInterval/(v.starHeld/100),
        sizeMin:base.sizeMin*v.starSize/100,sizeMax:base.sizeMax*v.starSize/100,rareSize:base.rareSize*v.starSize/100};
      this.sparkles=Array.from({length:v.starEnabled?Math.max(this.sparkleConfig.idleLimit,this.sparkleConfig.maxCount):0},()=>({active:false,age:0,life:1,angle:0,orbit:1,size:8,rate:1,x:0,y:0}));
      // Cache all three colors; each new sparkle keeps its chosen color until it fades.
      this.sparkleSprites=[[v.starColor1,v.starBlue,'#65eaff','35,195,255'],[v.starColor2,v.starPurple,'#ce83ff','168,70,255'],[v.starColor3,v.starWhite,'#ffffff','225,233,255']].filter(item=>item[1]).map(([core,enabled,original,defaultHalo])=>{
      const halo=core===original?defaultHalo:rgb(core);
      const sprite=createCanvas();sprite.width=sprite.height=128;
      const sc=sprite.getContext('2d');
      const glow=sc.createRadialGradient(64,64,0,64,64,60);
      glow.addColorStop(0,'rgba('+halo+',0.25)');
      glow.addColorStop(.35,'rgba('+halo+',0.12)');
      glow.addColorStop(1,'rgba('+halo+',0)');
      sc.fillStyle=glow;sc.fillRect(0,0,128,128);
      sc.fillStyle=core;sc.beginPath();sc.moveTo(64,24);
      sc.quadraticCurveTo(66,60,92,64);sc.quadraticCurveTo(66,68,64,104);
      sc.quadraticCurveTo(62,68,36,64);sc.quadraticCurveTo(62,60,64,24);
      sc.closePath();sc.fill();
      return sprite;
      });
      this.trails=new root.FingerTrails(v,createCanvas);
      this.time=0;this.phase=0;this.orbitTime=0;this.speed=this.idleSpeed;
      this.resize(width,height);this.reset();
    }
    resize(width,height) {
      this.width=Math.max(1,Number.isFinite(width)?width:1);
      this.height=Math.max(1,Number.isFinite(height)?height:1);
      this.trails.resize(this.width,this.height);
      this.cx=this.width/2;this.cy=this.height/2;
      this.radius=Math.min(this.width,this.height)*0.34;
      this.radius=Math.min(this.radius,260);
      this.radiusX=this.width*0.43;
      this.radiusY=this.height*0.44;
      this.referenceScaleX=this.width/REFERENCE_WIDTH;
      this.referenceScaleY=this.height/REFERENCE_HEIGHT;
      this.positionPools();
    }
    reset() {
      this.trails.reset();
      this.pointer.id=null;this.time=0;this.phase=0;this.orbitTime=0;this.speed=this.idleSpeed;
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
        Object.assign(q,{active:true,seed:n,age:0,life:cfg.lifeMin+sample(n,45)*(cfg.lifeMax-cfg.lifeMin),angle,orbit,size,
          rate:.8+sample(n,46)*.4,tint:Math.floor(sample(n,49)*this.sparkleSprites.length),x,y});
        break;
      }
    }
    down(id,x,y,now) {
      if(id===null||id===undefined||this.pointer.id!==null)return false;
      this.pointer.id=id;this.speedFrom=this.speed;this.speedElapsed=0;this.trails.down(x,y,now);return true;
    }
    move(id,x,y,now) {
      if(this.pointer.id===null||this.pointer.id!==id)return false;
      this.trails.move(x,y,now);return true;
    }
    release(id) {
      if(this.pointer.id===null||(id!==undefined&&id!==this.pointer.id))return false;
      this.pointer.id=null;this.speedFrom=this.speed;this.speedElapsed=0;this.trails.release();return true;
    }
    step(seconds,{freezeTrails=false,holdTrails=false}={}) {
      const dt=Number.isFinite(seconds)?Math.max(0,Math.min(seconds,0.05)):0;
      const held=this.pointer.id!==null,target=held?this.activeSpeed:this.idleSpeed;
      const duration=held?this.motion.accelerationSeconds:this.motion.decelerationSeconds;
      this.speedElapsed+=dt;
      const progress=Math.min(1,this.speedElapsed/Math.max(0.01,duration));
      const ease=progress*progress*(3-2*progress);
      this.speed=progress===1?target:this.speedFrom+(target-this.speedFrom)*ease;
      this.time+=dt;this.phase=(this.phase+this.speed*dt)%TAU;
      // Idle reproduces the preview's quiet motion; at full hold the reference
      // mean rate (.04 rad/s) maps to the configured turns/second, not half speed.
      const power=Math.max(0,Math.min(1,(this.speed-this.idleSpeed)/(this.activeSpeed-this.idleSpeed)));
      const idleRate=this.idleSpeed/root.ManaConfig.portalMotion.idleSpeed;
      this.orbitTime+=(idleRate+(this.activeSpeed/.04-idleRate)*power)*dt;
      this.positionPools();
      this.stepSparkles(dt);
      if(!freezeTrails)this.trails.step(dt,{freezeAging:holdTrails});
    }
    positionPools() {
      for(let i=0;i<this.mists.length;i++) {
        const q=this.mists[i];
        q.angle=(q.initialAngle+this.orbitTime*q.rate)%TAU;
        // The default exactly matches the reference. Values above 100% add excursions.
        q.orbitScale=1+Math.sin(this.time*.19+q.seed)*.055*Math.max(0,this.settings.mistDrift/100-1);
        q.radius=this.radius*q.orbitScale;
        q.referenceX=REFERENCE_WIDTH/2+Math.cos(q.angle)*190*q.orbitScale;
        q.referenceY=REFERENCE_HEIGHT/2+Math.sin(q.angle)*295*q.orbitScale;
        q.x=q.referenceX*this.referenceScaleX;q.y=q.referenceY*this.referenceScaleY;
      }
      for(let i=0;i<this.dots.length;i++) {
        const q=this.dots[i];
        q.angle=(q.initialAngle+this.orbitTime*q.rate)%TAU;
        q.radius=this.radius*q.orbitScale;
        q.referenceX=REFERENCE_WIDTH/2+Math.cos(q.angle)*170*q.orbitScale;
        q.referenceY=REFERENCE_HEIGHT/2+Math.sin(q.angle)*260*q.orbitScale;
        q.x=q.referenceX*this.referenceScaleX;q.y=q.referenceY*this.referenceScaleY;
      }
    }
    drawBackground(c=this.ctx,transform=null) {
      c.save();c.globalCompositeOperation='source-over';c.globalAlpha=1;
      c.scale(this.referenceScaleX,this.referenceScaleY);
      const g=c.createRadialGradient(195,300,25,195,300,410);
      g.addColorStop(0,this.settings.backgroundCenter);
      g.addColorStop(.6,'#101126');g.addColorStop(1,this.settings.backgroundOuter);
      c.fillStyle=g;c.fillRect(0,0,REFERENCE_WIDTH,REFERENCE_HEIGHT);
      for(const q of this.mists) {
        const pose=transform?.(q,'mist');
        if(pose&&pose.alpha<=.001)continue;
        const color=this.mistColors[q.tint],x=pose?pose.x/this.referenceScaleX:q.referenceX,
          y=pose?pose.y/this.referenceScaleY:q.referenceY,size=q.size*(pose?.scale??1),alpha=q.alpha*(pose?.alpha??1);
        const glow=c.createRadialGradient(x,y,0,x,y,size);
        glow.addColorStop(0,rgba(color,alpha));
        glow.addColorStop(.35,rgba(color,alpha*.45));glow.addColorStop(1,rgba(color,0));
        c.fillStyle=glow;c.fillRect(x-size,y-size,size*2,size*2);
      }
      const pointColor=rgb(this.settings.dotColor);
      for(const q of this.dots) {
        const pose=transform?.(q,'dot');
        if(pose&&pose.alpha<=.001)continue;
        c.fillStyle=rgba(pointColor,q.alpha*(pose?.alpha??1));
        c.beginPath();c.arc(pose?pose.x/this.referenceScaleX:q.referenceX,
          pose?pose.y/this.referenceScaleY:q.referenceY,Math.max(.1,q.size*(pose?.scale??1)),0,TAU);c.fill();
      }
      c.restore();
    }
    draw(quality=null,{transform=null,trails=true}={}) {
      const c=this.ctx;
      c.save();c.globalCompositeOperation='source-over';c.globalAlpha=1;
      this.drawBackground(c,transform);
      for(const q of this.sparkles) {
        if(!q.active)continue;
        const pose=transform?.(q,'star');
        if(pose&&pose.alpha<=.001)continue;
        const t=q.age/q.life;
        const phase=t<.2?t/.2:Math.max(0,(1-t)/.8);
        const envelope=phase*phase*(3-2*phase);
        const edge=Math.max(0,Math.min(1,Math.min(q.x,this.width-q.x,q.y,this.height-q.y)/(q.size*.8)));
        const size=q.size*(.45+.55*envelope)*1.6*(pose?.scale??1);
        c.globalAlpha=Math.min(1,.86*envelope*edge*this.settings.starOpacity/100)*(pose?.alpha??1);
        c.drawImage(this.sparkleSprites[q.tint],(pose?.x??q.x)-size/2,(pose?.y??q.y)-size/2,size,size);
      }
      if(trails)this.trails.draw(c);
      c.restore();
    }
  }
  root.PortalScene=PortalScene;
})(globalThis);
