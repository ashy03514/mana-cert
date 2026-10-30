/* Pointer/lifecycle adapter for the approved soft ribbon renderer. */
(function(root){
  'use strict';
  const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
  const smooth=v=>{v=clamp(v);return v*v*(3-2*v);};
  class FingerTrails {
    constructor(settings,createCanvas){
      settings=root.EffectSettings.normalize(settings);
      this.settings=settings;this.width=0;this.height=0;
      this.layer=createCanvas();this.layerCtx=this.layer.getContext('2d');
      this.maxPoints=900;this.maxStrokes=16;this.maxTotalPoints=8192;this.maxRoutePoints=8192;
      this.colors=settings.trailPalette.slice();
      this.renderer=new root.RibbonRenderer({hold:settings.trailHold,fade:settings.trailFade,
        flow:80*settings.trailFlowSpeed/100,width:settings.trailWidth/2.5,
        glowSize:settings.trailGlowSize/10,glowOpacity:settings.trailGlowOpacity/30,
        fingerSize:settings.trailFingerSize/24,flowEnabled:settings.trailFlowEnabled,
        flowDensity:settings.trailFlowDensity,dustEnabled:settings.trailDustEnabled,dustDensity:settings.trailDustDensity});
      this.reset();
    }
    reset(){this.time=0;this.retentionOffset=0;this.strokes=[];this.active=null;this.sequence=0;this.lastStamp=0;}
    get ageTime(){return this.time-this.retentionOffset;}
    resize(width,height){
      if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)return;
      if(width===this.width&&height===this.height)return;
      if(this.width&&this.height){
        for(const s of this.strokes){
          for(const p of s.points){p.x*=width/this.width;p.y*=height/this.height;}
          if(s.rawTip){s.rawTip.x*=width/this.width;s.rawTip.y*=height/this.height;}s.route=null;s.routeDemand=null;
        }
      }
      this.width=width;this.height=height;
      // Reference uses 2x backing; cap very large desktop buffers, not phone detail.
      this.scale=Math.min(2,2400/Math.max(width,height));
      this.layer.width=Math.max(1,Math.round(width*this.scale));this.layer.height=Math.max(1,Math.round(height*this.scale));
    }
    point(x,y){return {x:clamp(x,0,this.width),y:clamp(y,0,this.height)};}
    down(x,y,now=this.time*1000){
      if(!this.settings.trailEnabled||!Number.isFinite(x)||!Number.isFinite(y))return;
      this.release();const n=++this.sequence,random=Math.sin(n*127.1+49*311.7)*43758.5453;
      const index=this.settings.trailRandom?Math.floor((random-Math.floor(random))*this.colors.length):0;
      const p=this.point(x,y),s={points:[{...p,speed:.5}],rawTip:{...p},color:this.colors[index],released:null,
        seed:this.time+this.strokes.length,route:null};
      if(this.strokes.length===this.maxStrokes)this.strokes.shift();
      this.strokes.push(s);this.active=s;this.lastStamp=Number.isFinite(now)?now:this.time*1000;this.trimHistory();
    }
    move(x,y,now=this.time*1000){
      if(!this.active||!Number.isFinite(x)||!Number.isFinite(y))return;
      const p=this.point(x,y),points=this.active.points,last=points.at(-1);
      this.active.rawTip=p;
      const distance=Math.hypot(p.x-last.x,p.y-last.y);if(distance<1.2)return;
      const stamp=Number.isFinite(now)?now:this.time*1000,dt=Math.max(8,stamp-this.lastStamp);
      const gain=clamp(distance/10,.38,.9),speed=clamp(distance/dt);
      // Same distance-aware smoothing and velocity width as the approved preview.
      points.push({x:last.x+(p.x-last.x)*gain,y:last.y+(p.y-last.y)*gain,speed:last.speed*.65+speed*.35});
      if(points.length>this.maxPoints){
        const end=points.at(-1);let write=1;
        for(let i=2;i<points.length-1;i+=2)points[write++]=points[i];
        points[write++]=end;points.length=write;
      }
      this.active.route=null;this.active.routeDemand=null;this.lastStamp=stamp;this.trimHistory();
    }
    trimHistory(){
      let total=this.strokes.reduce((n,s)=>n+s.points.length,0);
      while(total>this.maxTotalPoints&&this.strokes.length>1)total-=this.strokes.shift().points.length;
    }
    release(){if(this.active){this.active.released=this.ageTime;this.active=null;}}
    step(dt,{freezeAging=false}={}){
      if(!Number.isFinite(dt)||dt<0)return;this.time+=dt;
      // Retain the drawing for the reveal without stopping packets, filaments,
      // and dust. Callers pause both clocks by not stepping at all.
      if(freezeAging)this.retentionOffset+=dt;
      // Reference ink fades over 1.5s; loose motes finish over 2.4s.
      const life=this.settings.trailHold+this.settings.trailFade*1.6;
      this.strokes=this.strokes.filter(s=>s.released===null||this.ageTime-s.released<life);
    }
    opacity(s){return s.released===null?1:1-smooth((this.ageTime-s.released-this.settings.trailHold)/this.settings.trailFade);}
    getRoute(s){return this.renderer.route(s);}
    draw(ctx){
      if(!this.settings.trailEnabled||!this.width||!this.height||!this.strokes.length)return;
      const c=this.layerCtx;c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,this.layer.width,this.layer.height);
      c.setTransform(this.scale,0,0,this.scale,0,0);c.globalAlpha=1;c.globalCompositeOperation='source-over';
      c.lineCap='round';c.lineJoin='round';this.renderer.time=this.time;this.renderer.ageTime=this.ageTime;
      const total=this.strokes.reduce((n,s)=>n+s.points.length,0);
      const requested=this.strokes.map(s=>Math.min(4096,this.renderer.routeSampleCount(s)));
      const extras=requested.reduce((n,count,i)=>n+count-this.strokes[i].points.length,0);
      const available=Math.max(0,this.maxRoutePoints-total);
      for(const s of this.strokes){
        const desired=requested[this.strokes.indexOf(s)];
        const budget=Math.max(32,extras<=available?desired:s.points.length+Math.floor(available*(desired-s.points.length)/extras));
        if(s.sampleBudget!==budget){s.sampleBudget=budget;s.route=null;}
        this.renderer.options.color=s.color;this.renderer.renderStroke(s,c);
      }
      ctx.save();ctx.globalCompositeOperation='source-over';ctx.globalAlpha=this.settings.trailOpacity/100;
      ctx.drawImage(this.layer,0,0,this.layer.width,this.layer.height,0,0,this.width,this.height);ctx.restore();
    }
  }
  root.FingerTrails=FingerTrails;
})(globalThis);
