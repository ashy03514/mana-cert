/* Drawn ribbons become depth-sorted orbs: burst, suspended drift, then implosion.
 * This layer owns only an immutable drawing snapshot, never input or reveal state. */
(function(root){
  'use strict';
  const TAU=Math.PI*2;
  const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
  const smooth=v=>{v=clamp(v);return v*v*(3-2*v);};
  const smoother=v=>{v=clamp(v);return v*v*v*(10+v*(-15+6*v));};
  const finite=(v,fallback=0)=>Number.isFinite(v)?v:fallback;
  const rand=(i,s=0)=>{const n=Math.sin(i*127.1+s*311.7)*43758.5453;return n-Math.floor(n);};
  const rgb=hex=>/^#[0-9a-f]{6}$/i.test(hex||'')?[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)):[125,234,255];
  const tint=(a,b,t)=>a.map((n,i)=>Math.round(n+(b[i]-n)*clamp(t)));
  const rgba=(c,a)=>'rgba('+c.join(',')+','+clamp(a)+')';
  const setting=(s,key,value,min,max)=>clamp(finite(s?.[key],value),min,max);
  const palette=colors=>Object.freeze((Array.isArray(colors)?colors:[])
    .filter(c=>typeof c==='string'&&/^#[0-9a-f]{6}$/i.test(c)).slice(0,12)
    .map(c=>Object.freeze(rgb(c))));
  function captureSettings(source={}){
    const colors=(key,defaults)=>{
      const values=palette(source[key]);
      return values.length?values:palette(defaults);
    };
    return Object.freeze({
      burstCount:setting(source,'burstCount',100,25,150)/100,
      burstSize:setting(source,'burstSize',100,50,200)/100,
      burstOpacity:setting(source,'burstOpacity',100,10,100)/100,
      burstRadius:setting(source,'burstRadius',100,50,160)/100,
      burstDepth:setting(source,'burstDepth',100,0,150)/100,
      burstDuration:setting(source,'burstDuration',2.1,1.2,4),
      burstUseTrail:source.burstUseTrail!==false,
      burstPalette:colors('burstPalette',['#7deaff','#ac82f3']),
      burstStarEnabled:source.burstStarEnabled!==false,
      burstStarCount:Math.round(setting(source,'burstStarCount',48,0,96)),
      burstStarSize:setting(source,'burstStarSize',100,50,200)/100,
      burstStarOpacity:setting(source,'burstStarOpacity',100,10,100)/100,
      burstStarSpin:setting(source,'burstStarSpin',100,0,200)/100,
      burstStarPalette:colors('burstStarPalette',['#65eaff','#ce83ff','#ffffff']),
      flashEnabled:source.flashEnabled!==false,
      flashCount:Math.round(setting(source,'flashCount',30,0,60)),
      flashSize:setting(source,'flashSize',100,50,250)/100,
      flashOpacity:setting(source,'flashOpacity',100,10,100)/100,
      flashDuration:setting(source,'flashDuration',.14,.06,.3),
      flashPalette:colors('flashPalette',['#65eaff','#ce83ff','#ffffff'])
    });
  }
  const pick=(colors,seed,salt)=>colors[Math.floor(rand(seed,salt)*colors.length)];
  const palettes={fire:[244,170,83],water:[118,218,237],wind:[192,216,183],
    earth:[195,169,116],light:[246,231,192],dark:[171,118,225]};
  class RevealGather {
    constructor(){
      this.width=0;this.height=0;this.routes=[];this.pointCount=0;this.moteCount=0;
      this.maxPoints=1600;this.maxMotes=180;this.snapshotTime=0;this.opacity=1;
      this.renderer=null;this.options={};
      this.orbs=Object.freeze([]);
      this.stars=Object.freeze([]);
      this.flashes=Object.freeze([]);
      this.settings=captureSettings();
    }
    resize(width,height){
      if(Number.isFinite(width)&&Number.isFinite(height)&&width>0&&height>0){
        this.width=width;this.height=height;
      }
    }
    capture(trails,width,height){
      this.routes=[];this.pointCount=0;this.moteCount=0;this.orbs=Object.freeze([]);this.stars=Object.freeze([]);this.flashes=Object.freeze([]);
      this.resize(width||trails?.width,height||trails?.height);
      this.settings=captureSettings(trails?.settings);
      const settings=this.settings;
      this.maxMotes=Math.round(180*settings.burstCount);
      if(!trails||!this.width||!this.height||trails.settings?.trailEnabled===false)return;
      this.snapshotTime=finite(trails.time);
      this.options={...trails.renderer?.options};
      this.opacity=clamp(finite(trails.settings?.trailOpacity,100)/100);
      this.renderer=root.RibbonRenderer?new root.RibbonRenderer(this.options):null;
      // Asking the live renderer for a route would mutate its geometry cache.
      // Work on a copy, including for strokes whose route has not been built yet.
      const visible=(trails.strokes||[]).filter(s=>s.points?.length&&
        (typeof trails.opacity==='function'?trails.opacity(s):1)>.03).slice(-16);
      const candidates=visible.map((s,index)=>{
        const points=s.points.filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)).map(p=>({
          x:p.x,y:p.y,speed:finite(p.speed,.5)
        }));
        if(!points.length)return null;
        const copy={points,seed:finite(s.seed,index),released:null,sampleBudget:1600};
        let route=this.renderer?.route(copy);
        if(!route){
          let length=0;
          route={points:points.map((p,i)=>{
            if(i)length+=Math.hypot(p.x-points[i-1].x,p.y-points[i-1].y);
            return {...p,d:length,nx:0,ny:1};
          }),length};route.length=length;
        }
        return {route,seed:copy.seed,color:rgb(s.color),
          opacity:clamp(typeof trails.opacity==='function'?finite(trails.opacity(s),1):1),
          weight:Math.max(8,route.length)};
      }).filter(Boolean);
      const sum=candidates.reduce((n,s)=>n+s.weight,0);
      let remaining=this.maxPoints;
      candidates.forEach((s,index)=>{
        const budget=Math.min(remaining-(candidates.length-index-1)*2,
          Math.max(2,Math.floor(this.maxPoints*s.weight/(sum||1))));
        const count=s.route.length<1?1:Math.min(budget,Math.max(2,Math.ceil(s.route.length/3.5)+1));
        const sample=(d)=>{
          if(this.renderer)return this.renderer.at(s.route,d);
          const source=s.route.points;
          let i=1;while(i<source.length-1&&source[i].d<d)i++;
          if(source.length===1)return source[0];
          const a=source[i-1],b=source[i],f=clamp((d-a.d)/Math.max(.001,b.d-a.d));
          return {x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f,nx:0,ny:1};
        };
        const points=Array.from({length:count},(_,i)=>{
          const p=sample(s.route.length*i/Math.max(1,count-1));
          return Object.freeze({x:p.x/this.width,y:p.y/this.height,speed:.5});
        });
        const route=Object.freeze({points:Object.freeze(points),seed:s.seed,color:Object.freeze(s.color),
          opacity:s.opacity,motes:Math.max(2,Math.ceil(s.route.length/10))});
        this.routes.push(route);this.pointCount+=count;remaining-=count;
      });
      const demand=this.routes.reduce((n,s)=>n+s.motes,0),orbs=[];
      const desired=Math.min(this.maxMotes,Math.round(Math.max(this.pointCount>1?72:2,demand)*settings.burstCount));
      let available=this.maxMotes;
      this.routes.forEach((route,index)=>{
        const count=Math.min(available,Math.max(1,Math.floor(route.motes*desired/(demand||1))));
        for(let i=0;i<count;i++){
          // Stratified samples keep the complete drawing represented, without
          // making cut-up chunks of its geometry visible for even one frame.
          const seed=route.seed*19+index*107+i*2.73;
          const along=clamp((i+.2+.6*rand(seed,2))/count)*(route.points.length-1);
          const lo=Math.floor(along),hi=Math.min(lo+1,route.points.length-1),f=along-lo;
          const a=route.points[lo],b=route.points[hi];
          orbs.push({
            x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f,
            depth:rand(seed,3)*2-1,seed,route:index,
            size:2.9+rand(seed,4)*2.1,
            opacity:route.opacity*(.75+.2*rand(seed,5)),
            color:settings.burstUseTrail?null:pick(settings.burstPalette,seed,61)
          });
        }
        available-=count;
      });
      // Destinations cover the whole circle, even for a straight source line.
      // Match angular order to the drawing so the outward travel does not
      // randomly criss-cross. The source only sets that matching, never density.
      orbs.sort((a,b)=>Math.atan2(a.y-.5,a.x-.5)-Math.atan2(b.y-.5,b.x-.5)||a.seed-b.seed);
      let sin=0,cos=0;
      orbs.forEach((orb,i)=>{
        const delta=Math.atan2(orb.y-.5,orb.x-.5)-TAU*(i+.5)/orbs.length;
        sin+=Math.sin(delta);cos+=Math.cos(delta);
      });
      const rotation=Math.atan2(sin,cos);
      this.orbs=Object.freeze(orbs.map((orb,i)=>{
        const depthBand=(i*.754877666+.31)%1;
        const foreground=depthBand>.84;
        return Object.freeze({...orb,
          angle:rotation+TAU*(i+.5+(rand(orb.seed,15)-.5)*.28)/orbs.length,
          spread:Math.sqrt(.12+.88*((i*.618033989+.27)%1)),
          depth:foreground?.82+.17*rand(orb.seed,16):-.9+1.45*depthBand/.84
        });
      }));this.moteCount=orbs.length;
      // A separate, bounded burst accent. Ambient star visibility does not
      // disable this brief reveal event, and none of the existing orbs change.
      const starColors=settings.burstStarPalette;
      const count=settings.burstStarEnabled&&this.orbs.length?settings.burstStarCount:0;
      this.stars=Object.freeze(Array.from({length:count},(_,i)=>{
        const source=this.orbs[Math.floor(i*this.orbs.length/count)],seed=source.seed+83.17+i*3.61;
        const life=(.25+.15*rand(seed,32))*(2.1/settings.burstDuration);
        return Object.freeze({
          seed,start:Math.min(.025+.35*rand(seed,31),Math.max(.005,.79-life)),life,
          size:4.6+9.4*rand(seed,33)**1.7,
          rotation:rand(seed,34)*TAU,spin:(rand(seed,35)>.5?1:-1)*(2.4+4.2*rand(seed,36)),
          color:pick(starColors,seed,62),
          orb:Object.freeze({...source,angle:source.angle+(rand(seed,37)-.5)*.24,
            spread:source.spread*(.72+.22*rand(seed,38)),depth:-.65+1.25*rand(seed,39)})
        });
      }));
      const flashes=settings.flashEnabled&&this.orbs.length?settings.flashCount:0;
      const scale=clamp(Math.min(this.width,this.height)/390,.65,1.6);
      const columns=Math.max(1,Math.ceil(Math.sqrt(flashes*5/6))),rows=Math.ceil(flashes/columns);
      const cells=columns*rows;
      // A coprime stride visits every cell, including when the pool is resized.
      const gcd=(a,b)=>b?gcd(b,a%b):a;
      let stride=Math.max(1,Math.round(cells*.57));
      while(gcd(stride,cells)!==1)stride++;
      this.flashes=Object.freeze(Array.from({length:flashes},(_,i)=>{
        const seed=this.orbs[i%this.orbs.length].seed+291.7+i*5.13;
        const start=.065+.44*(i+.15+.7*rand(seed,51))/flashes;
        const life=(.045+.04*rand(seed,52))*(2.1/settings.burstDuration)*(settings.flashDuration/.14);
        const size=(10+23*rand(seed,53)**1.7)*1.2*settings.flashSize;
        // Cover the whole viewport instead of sampling the ring of moving orbs.
        // Permuting the cells mixes upper, central and lower flashes in time;
        // jitter hides the grid while retaining coverage of its empty centre.
        const cell=(i*stride)%cells,column=cell%columns,row=Math.floor(cell/columns);
        const marginX=Math.min(.22,size*scale*1.2/this.width);
        const marginY=Math.min(.22,size*scale*1.2/this.height);
        const x=marginX+(1-2*marginX)*(column+.12+.76*rand(seed,54))/columns;
        const y=marginY+(1-2*marginY)*(row+.12+.76*rand(seed,55))/rows;
        return Object.freeze({x,y,size,start,life,
          color:pick(settings.flashPalette,seed,63)});
      }));
      Object.freeze(this.routes);
    }
    line(ctx,points,width,color,opacity){
      if(points.length<2||opacity<.001)return;
      ctx.lineWidth=Math.max(.2,width);ctx.strokeStyle=rgba(color,opacity);
      ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);
      for(let i=1;i<points.length;i++)ctx.lineTo(points[i].x,points[i].y);
      ctx.stroke();
    }
    glow(ctx,x,y,radius,color,opacity){
      if(opacity<.001)return;
      const g=ctx.createRadialGradient(x,y,0,x,y,radius);
      g.addColorStop(0,rgba(color,opacity));g.addColorStop(.3,rgba(color,opacity*.42));g.addColorStop(1,rgba(color,0));
      ctx.fillStyle=g;ctx.fillRect(x-radius,y-radius,radius*2,radius*2);
    }
    orbit(orb,target,scale){
      const cx=this.width/2,cy=this.height/2;
      const x=orb.x*this.width-cx,y=orb.y*this.height-cy;
      const angle=finite(orb.angle,rand(orb.seed,7)*TAU);
      const radius=Math.min(this.width,this.height)*.94*finite(orb.spread,.7)*this.settings.burstRadius;
      const endX=Math.cos(angle)*radius,endY=Math.sin(angle)*radius;
      const depth=orb.depth*this.settings.burstDepth;
      const perspective=1/(1-depth*.5);
      const px=endX/perspective,py=endY/perspective;
      const d=Math.hypot(endX,endY)||1,side=rand(orb.seed,10)>.5?1:-1;
      const burstEnd=.50+.07*rand(orb.seed,20)-.025*depth;
      const nudgeAt=burstEnd+.035+.025*rand(orb.seed,21);
      const pullAt=nudgeAt+.09+.025*rand(orb.seed,22);
      return {x,y,px,py,cx,cy,nx:-endY/d*side,ny:endX/d*side,
        bend:(18+rand(orb.seed,11)*32)*scale,
        burstEnd,nudgeAt,pullAt,push:.08+.06*rand(orb.seed,23),
        spin:side*(.22+.32*rand(orb.seed,24))*(1+depth*.18),
        // Independent clocks and foreground parallax create depth without
        // delaying the ribbon-to-orb conversion or changing the reveal clock.
        end:clamp(.955+.045*rand(orb.seed,12)-.015*depth,.93,1),depth,seed:orb.seed};
    }
    expanded(path,progress){
      const u=clamp(progress/path.burstEnd);
      const burst=u*u*(10+u*(-20+u*(15-4*u)));
      const nudge=smoother((progress-path.nudgeAt)/(path.pullAt-path.nudgeAt));
      const radius=1+path.push*nudge+.012*Math.sin(path.seed+progress*5);
      const angle=path.spin*progress,c=Math.cos(angle),s=Math.sin(angle);
      const px=(path.px*c-path.py*s)*radius,py=(path.px*s+path.py*c)*radius;
      // Radial expansion eases down, but each sphere continues travelling
      // around the screen centre. The extra outward push also keeps this drift.
      return {x:path.x+(px-path.x)*burst,y:path.y+(py-path.y)*burst,z:path.depth*burst};
    }
    position(path,progress,target){
      progress=clamp(progress);
      let {x,y,z}=this.expanded(path,progress),pull=0;
      if(progress>path.pullAt){
        const phase=clamp((progress-path.pullAt)/(path.end-path.pullAt));
        pull=phase**3;
        const u=1-pull;
        const tx=target.x-path.cx,ty=target.y-path.cy;
        const c1x=x+path.nx*path.bend,c1y=y+path.ny*path.bend;
        const c2x=tx+(x-tx)*.12+path.nx*path.bend*.65;
        const c2y=ty+(y-ty)*.12+path.ny*path.bend*.65;
        // Keep the moving outer position as the root of the inward curve.
        // At pull=0 its velocity carries through instead of dropping to zero.
        x=u*u*u*x+3*u*u*pull*c1x+3*u*pull*pull*c2x+pull**3*tx;
        y=u*u*u*y+3*u*u*pull*c1y+3*u*pull*pull*c2y+pull**3*ty;
        z*=1-pull;
      }
      const perspective=1/(1-z*.5);
      return {x:path.cx+x*perspective,y:path.cy+y*perspective,
        z,perspective,pull,alpha:1-smooth((pull-.75)/.24)};
    }
    ball(ctx,p,radius,color,opacity,glowScale,glowOpacity){
      if(opacity<.002)return;
      const near=smooth((p.z-.55)/.44),core=tint(color,[247,250,255],.8-near*.55);
      this.glow(ctx,p.x,p.y,radius*(2.8+near*.6)*glowScale,color,(.19-near*.07)*opacity*glowOpacity);
      // A soft luminous volume with a small off-centre highlight. Foreground
      // volumes have a broader edge, rather than a large opaque white centre.
      const r=radius*(1+near*.7);
      const g=ctx.createRadialGradient(p.x-r*.16,p.y-r*.2,0,p.x,p.y,r);
      g.addColorStop(0,rgba(core,opacity*(.92-near*.48)));
      g.addColorStop(.2,rgba(tint(color,core,.6),opacity*(.85-near*.44)));
      g.addColorStop(.47,rgba(color,opacity*(.57-near*.27)));
      g.addColorStop(.74,rgba(color,opacity*(.2-near*.07)));
      g.addColorStop(1,rgba(color,0));
      ctx.fillStyle=g;ctx.fillRect(p.x-r,p.y-r,r*2,r*2);
    }
    tail(ctx,points,radius,color,opacity){
      const first=points[0],last=points.at(-1);
      const gradient=ctx.createLinearGradient(first.x,first.y,last.x,last.y);
      gradient.addColorStop(0,rgba(color,0));
      gradient.addColorStop(.4,rgba(color,opacity*.14));
      gradient.addColorStop(1,rgba(color,opacity*.52));
      const edges=points.map((p,i)=>{
        const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)];
        const length=Math.hypot(b.x-a.x,b.y-a.y)||1,t=i/(points.length-1);
        const half=Math.max(.08,radius*.4*t);
        return {x:p.x,y:p.y,nx:-(b.y-a.y)/length*half,ny:(b.x-a.x)/length*half};
      });
      // One tapered silhouette avoids the bright seams produced by overlapping
      // round caps when a tail is drawn as many short independent strokes.
      ctx.fillStyle=gradient;ctx.beginPath();
      ctx.moveTo(edges[0].x+edges[0].nx,edges[0].y+edges[0].ny);
      for(let i=1;i<edges.length;i++)ctx.lineTo(edges[i].x+edges[i].nx,edges[i].y+edges[i].ny);
      for(let i=edges.length-1;i>=0;i--)ctx.lineTo(edges[i].x-edges[i].nx,edges[i].y-edges[i].ny);
      ctx.closePath();ctx.fill();
    }
    starFrame(star,progress,target,scale=1){
      progress=clamp(finite(progress));
      target={x:finite(target?.x,this.width/2),y:finite(target?.y,this.height/2)};
      scale=clamp(finite(scale,1),.1,3);
      const age=(progress-star.start)/star.life;
      const envelope=smooth(age/.18)*(1-smooth((age-.55)/.45));
      const twinkle=.68+.32*Math.sin(age*TAU+star.seed)**2;
      const p=this.position(this.orbit(star.orb,target,scale),progress,target);
      return {x:p.x,y:p.y,z:p.z,color:star.color,
        radius:star.size*scale*p.perspective*(.72+.28*envelope)*this.settings.burstStarSize,
        angle:star.rotation+star.spin*progress*this.settings.burstStarSpin*(this.settings.burstDuration/2.1),
        alpha:age<=0||age>=1?0:envelope*twinkle*(1-smooth((progress-.67)/.12))*this.settings.burstStarOpacity};
    }
    drawStars(ctx,{progress=0,formation=0,width=this.width,height=this.height,target}={}){
      if(!ctx||!this.stars.length||formation>0)return;
      this.resize(width,height);
      progress=clamp(finite(progress));
      const scale=clamp(Math.min(this.width,this.height)/390,.65,1.6);
      const frames=this.stars.map(star=>this.starFrame(star,progress,target,scale)).sort((a,b)=>a.z-b.z);
      ctx.save();ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;
      for(const p of frames){
        if(p.alpha<.003)continue;
        const r=p.radius,opacity=p.alpha*.88;
        this.glow(ctx,p.x,p.y,r*2.1,p.color,opacity*.13);
        // Four inward-curved arms, not a solid diamond. Rotation is evaluated
        // from the reveal clock, so pause/replay never depend on frame history.
        const c=Math.cos(p.angle),s=Math.sin(p.angle);
        const point=(x,y)=>[p.x+(x*c-y*s)*r,p.y+(x*s+y*c)*r];
        ctx.fillStyle=rgba(tint(p.color,[255,255,255],.4),opacity);
        ctx.beginPath();ctx.moveTo(...point(0,-1));
        ctx.quadraticCurveTo(...point(.11,-.1),...point(.74,0));
        ctx.quadraticCurveTo(...point(.11,.1),...point(0,1));
        ctx.quadraticCurveTo(...point(-.11,.1),...point(-.74,0));
        ctx.quadraticCurveTo(...point(-.11,-.1),...point(0,-1));
        ctx.closePath();ctx.fill();
      }
      ctx.restore();
    }
    flashFrame(flash,progress){
      progress=clamp(finite(progress));
      const age=(progress-flash.start)/flash.life;
      const alpha=age<=0||age>=1?0:smooth(age/.12)*(1-smooth((age-.12)/.88));
      const scale=clamp(Math.min(this.width,this.height)/390,.65,1.6);
      return {x:flash.x*this.width,y:flash.y*this.height,radius:flash.size*scale,
        angle:0,alpha:alpha*this.settings.flashOpacity,color:flash.color};
    }
    drawFlashes(ctx,{progress=0,formation=0,width=this.width,height=this.height}={}){
      if(!ctx||!this.flashes.length||formation>0)return;
      this.resize(width,height);
      ctx.save();ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;
      for(const flash of this.flashes){
        const p=this.flashFrame(flash,progress);
        if(p.alpha<.003)continue;
        const r=p.radius,point=(x,y)=>[p.x+x*r,p.y+y*r];
        this.glow(ctx,p.x,p.y,r*.95,p.color,p.alpha*.16);
        // Preserve the chosen palette's saturation in both the hot core and
        // needle arms. Brightness comes from the pulse, not mixing in white.
        this.glow(ctx,p.x,p.y,r*.18,p.color,p.alpha*.6);
        ctx.fillStyle=rgba(p.color,p.alpha*.98);
        // Long needle tips with a tiny concave shoulder. Size, position and
        // orientation remain fixed: only a sharp light pulse changes over time.
        ctx.beginPath();ctx.moveTo(...point(0,-1.12));
        ctx.lineTo(...point(.032,-.22));ctx.quadraticCurveTo(...point(.04,-.04),...point(.22,-.032));
        ctx.lineTo(...point(1,0));ctx.lineTo(...point(.22,.032));
        ctx.quadraticCurveTo(...point(.04,.04),...point(.032,.22));ctx.lineTo(...point(0,1.12));
        ctx.lineTo(...point(-.032,.22));ctx.quadraticCurveTo(...point(-.04,.04),...point(-.22,.032));
        ctx.lineTo(...point(-1,0));ctx.lineTo(...point(-.22,-.032));
        ctx.quadraticCurveTo(...point(-.04,-.04),...point(-.032,-.22));
        ctx.closePath();ctx.fill();
      }
      ctx.restore();
    }
    draw(ctx,{progress=0,formation=0,width=this.width,height=this.height,target,element='fire',time=0}={}){
      if(!ctx||!this.routes.length)return;
      this.resize(width,height);width=this.width;height=this.height;
      progress=clamp(finite(progress));formation=clamp(finite(formation));time=finite(time);
      if(!width||!height||formation>=.4)return;
      target={x:finite(target?.x,width/2),y:finite(target?.y,height*.5)};
      const colorTarget=element===null?[194,201,224]:palettes[element]||palettes.fire,colorMix=smooth((progress-.68)/.29);
      const scale=clamp(Math.min(width,height)/390,.65,1.6),widthScale=clamp(finite(this.options.width,1),.3,3);
      const glowScale=clamp(finite(this.options.glowSize,1),.25,2);
      const glowOpacity=clamp(finite(this.options.glowOpacity,1),0,2);
      ctx.save();ctx.globalCompositeOperation='source-over';ctx.lineCap='round';ctx.lineJoin='round';
      ctx.globalAlpha=this.opacity;
      const original=1-smooth(progress/.055),transfer=smooth(progress/.025)*(1-smooth(formation/.3));
      // Only the unbroken original silhouette is rendered during the first
      // ~115 ms. The next layer is already made of spheres, never line sections.
      if(original>.001&&this.renderer)for(const route of this.routes){
        const points=route.points.map(p=>({x:p.x*width,y:p.y*height,speed:p.speed}));
        let length=0;
        for(let i=0;i<points.length;i++){
          if(i)length+=Math.hypot(points[i].x-points[i-1].x,points[i].y-points[i-1].y);
          points[i].d=length;
          const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)];
          const d=Math.hypot(b.x-a.x,b.y-a.y)||1;points[i].nx=-(b.y-a.y)/d;points[i].ny=(b.x-a.x)/d;
        }
        ctx.save();ctx.globalAlpha*=original*route.opacity;
        this.renderer.options.color='#'+route.color.map(v=>v.toString(16).padStart(2,'0')).join('');
        this.renderer.time=this.snapshotTime+time;
        this.renderer.ageTime=this.snapshotTime;
        this.renderer.renderStroke({points,route:{points,length},released:this.snapshotTime,seed:route.seed},ctx);ctx.restore();
      }
      const bodies=this.orbs.map(orb=>{
        const route=this.routes[orb.route],path=this.orbit(orb,target,scale),p=this.position(path,progress,target);
        const color=tint(orb.color||tint(route.color,[172,130,243],rand(orb.seed,14)*.65),colorTarget,colorMix);
        const focus=smooth((p.z-.55)/.44);
        const radius=orb.size*scale*Math.sqrt(widthScale)*p.perspective*(1+focus*1.5)*(1-p.pull*.62)*this.settings.burstSize;
        return {orb,path,p,color,radius,alpha:orb.opacity*transfer*p.alpha*(.78+.22*smooth((p.z+1)/2))*this.settings.burstOpacity};
      }).sort((a,b)=>a.p.z-b.p.z);
      // Trails sample the same continuous 3D path as their heads. Suspended
      // orbs have virtually no tail; rapid inward travel stretches into a curve.
      for(const {path,p,color,radius,alpha} of bodies){
        if(alpha<.002)continue;
        const lookback=.016+.039*smooth((progress-path.pullAt)/.22);
        const tail=[];
        for(let j=0;j<=8;j++)tail.push(this.position(path,Math.max(0,progress-lookback*(1-j/8)),target));
        const span=Math.hypot(tail[0].x-p.x,tail[0].y-p.y);
        // A short, wide tail would read as a triangular highlight inside a
        // defocused foreground sphere. Drift stays round; only fast travel
        // stretches a tail beyond the visible body.
        if(span<Math.max(3,radius*2.5))continue;
        const strength=smooth((span-radius)/(18+radius))*alpha;
        this.line(ctx,tail,radius*3*glowScale,color,.024*strength*glowOpacity);
        this.tail(ctx,tail,radius,color,strength);
      }
      for(const {p,color,radius,alpha} of bodies){
        this.ball(ctx,p,radius,color,alpha,glowScale,glowOpacity);
      }
      this.drawStars(ctx,{progress,formation,width,height,target});
      this.drawFlashes(ctx,{progress,formation,width,height});
      // A few low-energy arrival wisps bridge into the first material frame.
      const arrival=smooth((progress-.84)/.16)*(1-smooth(formation/.4));
      if(arrival>.001){
        for(let i=0;i<4;i++){
          const angle=i*TAU/4+time*.65,radius=(13+i*3)*scale*(1-formation*.8),pts=[];
          for(let j=0;j<=8;j++){
            const a=angle+j*.065,r=radius*(1-j*.035);
            pts.push({x:target.x+Math.cos(a)*r,y:target.y+Math.sin(a)*r*.55});
          }
          this.line(ctx,pts,.65*scale,colorTarget,.15*arrival);
          if(i%2===0)this.glow(ctx,pts[3].x,pts[3].y,8*scale,colorTarget,.035*arrival);
        }
      }
      ctx.restore();
    }
  }
  root.RevealGather=RevealGather;
})(globalThis);
