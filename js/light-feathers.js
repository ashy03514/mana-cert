/* Luminous feather releases. Absolute event time keeps flight continuous across
 * awakening, formation and rank growth, including pause/replay and resizing. */
(function(root){
  'use strict';
  const TAU=Math.PI*2,clamp=n=>Math.max(0,Math.min(1,n));
  const smooth=n=>{const p=clamp(n);return p*p*(3-2*p);};
  const seed=n=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);};
  const originalCounts=Object.freeze({awakening:20,A:14,S:20,SS:26});
  const wingPools=new WeakMap();
  const smoothBetween=(a,b,t)=>smooth((t-a)/(b-a));
  function inverseSmooth(value){
    let lo=0,hi=1;
    for(let i=0;i<24;i++){const mid=(lo+hi)/2;if(smooth(mid)<value)lo=mid;else hi=mid;}
    return (lo+hi)/2;
  }
  function wingPool(image){
    if(!image||typeof document==='undefined')return [];
    if(wingPools.has(image))return wingPools.get(image);
    const canvas=document.createElement('canvas');canvas.width=192;
    canvas.height=Math.max(1,Math.round(192*(image.naturalHeight||image.height)/(image.naturalWidth||image.width)));
    const c=canvas.getContext('2d');c.drawImage(image,0,0,canvas.width,canvas.height);
    const rgba=c.getImageData(0,0,canvas.width,canvas.height).data,pool=[];
    for(let y=1;y<canvas.height-1;y+=2)for(let x=1;x<canvas.width-1;x+=2){
      const alpha=rgba[(y*canvas.width+x)*4+3]/255,u=(x+.5)/canvas.width,v=(y+.5)/canvas.height;
      if(alpha>.72&&Math.abs(u-.5)>.065)pool.push({u,v,alpha});
    }
    wingPools.set(image,pool);return pool;
  }
  function wingBurst({kind,at,duration,rank=kind,from=rank,image,layoutAt,poseAt,evolving=false}){
    const count=originalCounts[kind]*.5,pool=wingPool(image),offset=rank==='A'?.10:0;
    const templates=[[.13,.57],[.24,.48],[.36,.34],[.20,.74],[.31,.29],[.29,.67],[.14,.69]];
    const rootArt=layoutAt(0),births=[];
    for(let i=0;i<count;i++){
      const side=i%2?1:-1,template=templates[Math.floor(i/2)%templates.length];
      const wanted={u:.5+side*(template[0]+(seed(i+93)-.5)*.02),v:template[1]-offset+(seed(i+37)-.5)*.018};
      let anchor={...wanted,alpha:1},best=Infinity;
      for(const candidate of pool){
        if((candidate.u-.5)*side<=0)continue;
        const score=(candidate.u-wanted.u)**2+(candidate.v-wanted.v)**2*.55;
        if(score<best){best=score;anchor=candidate;}
      }
      const x=Math.abs(anchor.u-.5),y=anchor.v+offset;
      // Same four banks/fronts as light-angel-layered-growth-renderer.js.
      // Release just behind the visible feathering front, not after the entire
      // new silhouette has formed. Incoming feather alpha is about 80% here.
      const shoulder=1-smoothBetween(.08,.19,x),tail=smoothBetween(.65,.79,y)*(1-shoulder);
      const primary=smoothBetween(.21,.32,x)*(1-smoothBetween(.46,.66,y))*(1-shoulder-tail);
      const weights=[shoulder,primary,Math.max(0,1-shoulder-tail-primary),tail];
      const bank=weights.indexOf(Math.max(...weights)),reach=clamp(Math.hypot(x,(y-.72)*.78)/.60);
      const ranges=[[.08,.77],[.13,.86],[.19,.88],[.38,.93]],range=ranges[bank];
      const front=range[0]+(range[1]-range[0])*reach,progress=clamp(front+.024);
      const delay=duration*(evolving?inverseSmooth(progress):.30+.56*(i+.3)/count);
      const pose=poseAt(delay),art=layoutAt(delay),p=clamp(pose.progress??1);
      let px=x,py=y;
      if(evolving){
        // Invert the selected bank's small rigid unfold transform to locate
        // the sampled target feather on the actual opening mesh at birth.
        const phase=smoothBetween(front-.055,front+.055,p),amount=1-phase;
        const transforms=[[.012,.025,.70,0,0],[-.048,.17,.48,-.018,.016],[-.030,.14,.55,-.014,.012],[.040,.10,.67,-.008,-.018]];
        const [angle,ox,oy,dx,dy]=transforms[bank],a=-angle*amount,c=Math.cos(a),s=Math.sin(a);
        px=ox+c*(x-ox)-s*(y-oy)+dx*amount;py=oy+s*(x-ox)+c*(y-oy)+dy*amount;
      }
      const u=.5+side*px,v=py;
      const point=r=>root.LightAngelMotion?root.LightAngelMotion.point(u,v,pose.time,side,r):{x:side*px,y:(py-.72)/1.5};
      const a=point(from),z=point(rank),mix=evolving?p:1;
      births.push({delay,x:art.cx+(a.x+(z.x-a.x)*mix)*art.width,y:art.cy+(a.y+(z.y-a.y)*mix)*art.width,
        side,rotation:side*(.40+x*.9+(y>.65?.25:0)),sourceU:anchor.u,sourceV:anchor.v,sourceAlpha:anchor.alpha,
        bank,front,progress:p});
    }
    return {kind,at,duration,x:rootArt.cx,y:rootArt.cy,births};
  }
  const source=typeof document!=='undefined'?document.currentScript?.src||document.baseURI:'';
  let texture=null,loaded=false,error='',ready=null;
  function load(){
    if(ready)return ready;
    if(typeof Image==='undefined')return Promise.resolve(false);
    ready=new Promise(resolve=>{
      const image=new Image();image.decoding='async';
      const finish=ok=>{image.onload=image.onerror=null;resolve(ok);};
      image.onload=()=>{
        // Decode once; a modest cached texture retains the generated barbs
        // without resampling the full-resolution master for every particle.
        try{
          texture=document.createElement('canvas');texture.height=768;
          texture.width=Math.round(768*image.naturalWidth/image.naturalHeight);
          const c=texture.getContext('2d');c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';
          c.drawImage(image,0,0,texture.width,texture.height);loaded=true;finish(true);
        }catch(e){error='羽毛素材無法載入，請重新整理。';finish(false);}
      };
      image.onerror=()=>{error='羽毛素材無法載入，請重新整理。';finish(false);};
      image.src=root.LightAngelFeatherAsset||new URL('../assets/light-angel-feather-v1.png',source).href;
    });
    return ready;
  }
  function samples({width,height,time=0,bursts=[]}={}){
    if(!(width>0&&height>0)||!Number.isFinite(time))return [];
    const unit=Math.min(width,height),frames=[];
    for(let b=0;b<bursts.length;b++){
      const burst=bursts[b],population=originalCounts[burst.kind],count=population*.5;
      if(!count||!Number.isFinite(burst.at)||!Number.isFinite(burst.x)||!Number.isFinite(burst.y))continue;
      const elapsed=time-burst.at;if(elapsed<0||elapsed>5.6+(burst.duration||0))continue;
      for(let i=0;i<count;i++){
        // Every release uses half its original population. Keep the original
        // seed population so retained feathers follow the same floating paths.
        const key=i+b*79+population*11,lane=seed(key+3),birth=burst.births?.[i],shed=!!birth;
        const stagger=birth?.delay??seed(key+19)*.58,originX=birth?.x??burst.x,originY=birth?.y??burst.y;
        const age=elapsed-stagger,life=3.8+seed(key+71)*1.1;
        if(age<=0||age>=life)continue;
        const p=age/life,near=i%4===0,far=i%4===1;
        // A gentle updraft releases each feather, then air resistance removes
        // the initial outward speed. Depth continues slowly after the release
        // instead of turning the foreground into a fast camera zoom.
        const depth=(near?.58:far?-.23:.14+lane*.13)*(1-Math.exp(-age*.52));
        const perspective=1/(1-depth);
        const angle=shed?(birth.side<0?Math.PI+.12:-.12):i*2.399963+(seed(key+38)-.5)*.35;
        const distance=unit*(shed?(.060+lane*.055)*(1-Math.exp(-age*1.55))+.008*age
          :(.15+lane*.18)*(1-Math.exp(-age*1.55))+.012*age);
        const phase=seed(key+91)*TAU,flutter=.95+lane*.38;
        const drift=unit*((.022+seed(key+29)*.020)*(Math.sin(phase+age*flutter)-Math.sin(phase))
          *smooth(age/.6)+(lane-.5)*.014*age);
        const lift=-unit*((shed?.018:.060)+lane*(shed?.012:.030))*(1-Math.exp(-age*1.2));
        const fall=unit*(shed?.015:.010)*age*age;
        const bob=unit*.009*(Math.sin(phase+age*1.65)-Math.sin(phase))*smooth(age/.8);
        const x=originX+(Math.cos(angle)*distance+Math.sin(angle)*drift)*perspective;
        const y=originY+(Math.sin(angle)*distance*.76-Math.cos(angle)*drift*.62+lift+fall+bob)*perspective;
        const length=unit*(near?.105+lane*.026:far?.023+lane*.016:.043+lane*.022)*perspective;
        frames.push({id:b+':'+i,burstKind:burst.kind,age,originX,originY,x,y,length,depth,
          detachedAt:burst.at+stagger,sourceU:birth?.sourceU,sourceV:birth?.sourceV,sourceAlpha:birth?.sourceAlpha,
          // The long axis rocks independently from travel direction. A broad
          // visible face gently turns, never collapsing to a thin edge-on line.
          rotation:shed?birth.rotation+(Math.sin(phase+age*flutter)-Math.sin(phase))*.38
            +(Math.sin(key+age*1.95)-Math.sin(key))*.09
            :(seed(key+26)-.5)*2.1+(i%3===0?Math.PI:0)+Math.sin(phase+age*flutter)*.38+Math.sin(key+age*1.95)*.09,
          roll:.66+.34*(.5+.5*Math.sin(phase+age*(.80+lane*.40))),
          alpha:smooth(age/.26)*(1-smooth((p-.66)/.34))*.5,
          brightness:1.25,
          blur:near?Math.max(0,perspective-1.08)*.85*Math.max(.7,unit/390):0,
          variant:i%3});
      }
    }
    return frames.sort((a,b)=>a.depth-b.depth);
  }
  function draw(ctx,options){
    if(!loaded){load();return [];}
    const frames=samples(options);if(!ctx||!frames.length)return frames;
    ctx.save();ctx.globalCompositeOperation='source-over';
    for(const f of frames){
      // Let near feathers fly past the viewport naturally, never pin to edges.
      if(f.x+f.length<0||f.y+f.length<0||f.x-f.length>options.width||f.y-f.length>options.height)continue;
      ctx.save();ctx.translate(f.x,f.y);ctx.rotate(f.rotation);ctx.scale(f.roll*(f.variant===1?-1:1),1);
      ctx.globalAlpha=f.alpha;
      const filters=[];
      if(f.blur>.15)filters.push('blur('+f.blur.toFixed(2)+'px)');
      if(f.brightness!==1)filters.push('brightness('+f.brightness+')');
      ctx.filter=filters.join(' ')||'none';
      const height=f.length/ .965,width=height*texture.width/texture.height;
      ctx.drawImage(texture,-width*.5,-height*.5,width,height);ctx.restore();
    }
    ctx.restore();return frames;
  }
  root.LightFeathers=Object.freeze({samples,draw,wingBurst,load,get ready(){return load();},get loaded(){return loaded;},get error(){return error;}});
  if(typeof Image!=='undefined')load();
})(globalThis);
