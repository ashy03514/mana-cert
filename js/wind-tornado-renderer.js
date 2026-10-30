/* Ranked wind material. The host owns time, pause, formation and the result.
 * A retained 2D frame keeps a paused WebGL drawing buffer from disappearing.
 */
(function(root){
  'use strict';
  const clamp=(v,min=0,max=1)=>Math.max(min,Math.min(max,v));
  const smooth=v=>{v=clamp(v);return v*v*(3-2*v);};
  const hash=n=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);};
  // One visual clock for the volume, surface wind and airborne debris. The
  // host's clock and phase lengths stay unchanged, including pause and replay.
  const VISUAL_SPEED=1.5;
  class WindTornadoRenderer {
    constructor(createCanvas=()=>document.createElement('canvas')){
      this.canvas=createCanvas();this.patch=createCanvas();this.patchCtx=this.patch.getContext('2d');
      this.stormBackdrop=typeof root.WindBackdrop==='function'?new root.WindBackdrop(createCanvas):null;
      this.gl=null;this.program=null;this.buffer=null;this.uniforms={};
      this.error='';this.lost=false;this.disposed=false;this.time=0;this.visualTime=0;this.backdropTime=0;this.playbackRate=1;
      this.lastTime=-Infinity;this.lastKey='';this.drawCount=0;this.renderBox=null;
      this.onLost=event=>{event.preventDefault();this.lost=true;this.error='龍捲風暫時中斷，正在等待恢復。';};
      this.onRestored=()=>{
        if(this.disposed)return;
        this.gl=null;this.program=null;this.buffer=null;this.lost=false;this.error='';
        this.lastTime=-Infinity;this.lastKey='';this.init();
      };
      this.canvas.addEventListener('webglcontextlost',this.onLost);
      this.canvas.addEventListener('webglcontextrestored',this.onRestored);
      this.init();
    }
    init(){
      if(this.lost||this.disposed||this.error)return false;
      if(this.program)return true;
      const shaders=[];let program=null;
      try{
        const gl=this.gl||this.canvas.getContext('webgl',{alpha:true,premultipliedAlpha:true,
          antialias:false,depth:false,stencil:false,preserveDrawingBuffer:false});
        if(!gl)throw Error('WebGL unavailable');
        this.gl=gl;
        for(const [type,source] of [[gl.VERTEX_SHADER,root.WindTornadoShader.vertex],[gl.FRAGMENT_SHADER,root.WindTornadoShader.fragment]]){
          const shader=gl.createShader(type);shaders.push(shader);gl.shaderSource(shader,source);gl.compileShader(shader);
          if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));
        }
        program=gl.createProgram();shaders.forEach(shader=>gl.attachShader(program,shader));gl.linkProgram(program);
        if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
        this.program=program;this.position=gl.getAttribLocation(program,'aPosition');
        for(const name of ['uTime','uField','uFormation','uShape','uCohesion','uCloudFlash','uFunnelFlash'])this.uniforms[name]=gl.getUniformLocation(program,name);
        this.buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
        gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
        gl.disable(gl.DEPTH_TEST);gl.disable(gl.BLEND);this.error='';return true;
      }catch(error){
        if(program)this.gl.deleteProgram(program);this.program=null;
        this.error='目前無法顯示龍捲風，請返回設定後重試。';this.diagnostic=String(error);return false;
      }finally{if(this.gl)shaders.forEach(shader=>this.gl.deleteShader(shader));}
    }
    layout(width,height,profile=root.WindRankEffects.forRank('SS')){
      const h=Math.max(40,Math.min(height*.55,height-278,550));
      const w=Math.min(width*.96,h/1.34);
      // Move the cloud cross-section at world y=.95 to the top of the screen,
      // magnifying around the existing ground contact (world y=-.85). This is
      // about 1.5x in portrait; the off-screen cloud is intentionally retained.
      const gatherY=54+w*1.34/2,groundY=gatherY+(.20+.85)*w/2;
      const unit=groundY/(.95+.85),zoomedWidth=unit*2,zoomedHeight=zoomedWidth*1.34;
      return this.rankBox({x:(width-zoomedWidth)/2,y:groundY-zoomedHeight/2-(.20+.85)*unit,
        width:zoomedWidth,height:zoomedHeight,gatherY},profile);
    }
    rankBox(box,profile=root.WindRankEffects.forRank('SS')){
      const heightScale=profile.heightScale??1;
      if(profile.sizeScale===1&&heightScale===1)return {...box};
      // Every grade now grows from the same ground contact. C lowers only
      // its crown; D/E also narrow the full funnel without moving the foot.
      const width=box.width*profile.sizeScale,height=box.height*profile.sizeScale*heightScale;
      const cx=box.x+box.width/2,ground=box.y+box.height/2+1.05*box.height/2.68;
      return {...box,x:cx-width/2,y:ground-height/2-1.05*height/2.68,width,height};
    }
    scanLayout(width,height,profile=root.WindRankEffects.forRank('E'),shift=1){
      const amount=smooth(clamp(shift)),sideBySide=width>=height*1.35;
      const reference=this.layout(width,height,root.WindRankEffects.forRank('SS'));
      const box=this.layout(width,height,profile),unit=reference.width/2;
      const ground=reference.y+reference.height/2+1.05*unit;
      const compact=!sideBySide&&height<760;
      const fontSize=Math.max(32,Math.min(compact?32:52,width*.125,height*.075));
      const rankFontSize=Math.max(19,Math.min(26,fontSize*.5));
      const labelFontSize=compact?12:Math.max(14,Math.min(18,fontSize*.36));
      let x=width/2,y;
      if(sideBySide){
        box.x+=(width*.30-width/2)*amount;x=width*.70;
        y=Math.max(70+fontSize+labelFontSize+16,
          Math.min(height-80-rankFontSize-22,(70+height-80)/2+fontSize*.2));
      }else{
        // Leave space below the ground haze before the attribute title.
        y=Math.min(height-80-rankFontSize-22,ground+72+fontSize+labelFontSize*.35);
        y=Math.max(70+fontSize+labelFontSize+16,y);
      }
      const numbers={x,y,fontSize,rankFontSize,labelFontSize,
        labelY:y-fontSize-labelFontSize*.35,rankY:y+rankFontSize+14};
      const readoutWidth=Math.min(width*(sideBySide?.42:.84),360),readoutTop=numbers.labelY-52;
      return {box,sideBySide,numbers,readout:{x:x-readoutWidth/2,y:readoutTop,width:readoutWidth,
        height:numbers.rankY+rankFontSize*.5+12-readoutTop}};
    }
    backdrop(ctx,width,height,opacity){
      if(opacity<=0)return;
      // Keep the study and reveal on the same storm palette. An opaque base at
      // full formation prevents the portal's purple fog/stars showing through.
      ctx.save();ctx.globalAlpha*=opacity;
      const base=ctx.createLinearGradient(0,0,0,height);
      base.addColorStop(0,'#0c1722');base.addColorStop(.65,'#060c14');base.addColorStop(1,'#101d25');
      ctx.fillStyle=base;ctx.fillRect(0,0,width,height);
      const haze=(x,y,rx,ry,color)=>{
        ctx.save();ctx.translate(width*x,height*y);ctx.scale(width*rx,height*ry);
        const glow=ctx.createRadialGradient(0,0,0,0,0,1);
        glow.addColorStop(0,color);glow.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle=glow;ctx.fillRect(-1,-1,2,2);ctx.restore();
      };
      haze(.5,.15,.62,.60,'rgba(38,61,72,.40)');
      haze(.08,.30,.50,.46,'rgba(136,169,172,.05)');
      haze(.92,.65,.54,.48,'rgba(124,155,154,.05)');
      ctx.restore();
    }
    spine(h,time,profile=root.WindRankEffects.forRank('SS')){
      // Match the volume's bounded S bend so surface streaks and leaves never
      // orbit an old, straight axis while the visible funnel moves away.
      const bend=4*h*(1-h);
      return {
        x:(.23*bend*Math.sin(7.1*h-.75*time)+.055*bend*Math.sin(12.2*h+.97*time)+.075*h*Math.sin(4.2*h-.37*time))*profile.swayScale,
        z:(.10*bend*Math.sin(6.4*h-.58*time)+.035*h*Math.sin(3.9*h+.42*time))*profile.swayScale
      };
    }
    ringPoint(angle,time,radius=1){
      const y=-.08+.63*Math.sin(angle)*radius;
      return {x:.38*Math.cos(angle)*radius+.19*y,y,z:.24*y+.10*Math.sin(2*angle-time*.22)};
    }
    envelope(h,profile){
      const height=clamp(h),cohesion=profile.cohesion??1;
      const mature=.054+.54*Math.pow(height,1.45)+.14*Math.pow(height,5);
      const loose=.24+.28*Math.pow(height,.65);
      return loose+(mature-loose)*cohesion;
    }
    detailScale(box,profile){
      return box.width/(profile.sizeScale||1)/360;
    }
    surface(h,angle,time,profile=root.WindRankEffects.forRank('SS')){
      const {x,z}=this.spine(h,time,profile);
      const radius=this.envelope(h,profile)*profile.widthScale;
      const funnel={x:x+Math.cos(angle)*radius,z:z+Math.sin(angle)*radius,y:-.86+h*1.78};
      if(profile.vortexMix<=0)return funnel;
      const ring=this.ringPoint(angle,time,.91+h*.16),mix=clamp(profile.vortexMix);
      return {x:funnel.x+(ring.x-funnel.x)*mix,y:funnel.y+(ring.y-funnel.y)*mix,z:funnel.z+(ring.z-funnel.z)*mix};
    }
    populationWeight(index,count,scale=1){
      // Stable slots fade in one by one during a rank transition. Fractional
      // final slots preserve the exact percentage without rerolling particles.
      return clamp(count*clamp(scale)-index);
    }
    linePoints(box,headH,headAngle,span,time,profile){
      const unit=box.width/2,unitY=box.height/2.68,cx=box.x+unit,cy=box.y+box.height/2+.2*unitY;
      const curve=(arc,drop,p,ux,uy)=>Array.from({length:19},(_,j)=>{
        const s=j/18,h=headH-(1-s)*drop,angle=headAngle+arc*(1-s),q=this.surface(h,angle,time,p);
        return {x:cx+q.x*ux,y:cy-(q.y+q.z*.105)*uy,z:Math.sin(angle)*(1-p.vortexMix)+q.z/.25*p.vortexMix};
      });
      const length=points=>points.reduce((sum,p,i)=>i?sum+Math.hypot(p.x-points[i-1].x,p.y-points[i-1].y):0,0);
      if(profile.widthScale>=.5&&profile.heightScale>=.8)return curve(span,.105,profile,unit,unitY);
      // Leaves and streak lengths are scale cues. A small immature vortex
      // bends the same readable length around a tighter orbit instead of
      // shrinking the whole streak with the funnel.
      const reference=root.WindRankEffects.forRank('C');
      const referenceY=unitY*.8/profile.heightScale;
      const target=length(curve(span,.105,reference,unit,referenceY));
      const drop=Math.min(.105*.8/profile.heightScale,headH-.025);
      // Walk one bounded arc from the head, stopping at the desired length.
      // Accumulated length stays monotonic even as the arc turns edge-on.
      let distance=0,end=1,previous=null;
      for(let i=0;i<=72;i++){
        const f=i/72,q=this.surface(headH-drop*f,headAngle+3.8*f,time,profile);
        const point={x:q.x*unit,y:(q.y+q.z*.105)*unitY};
        if(previous){
          const segment=Math.hypot(point.x-previous.x,point.y-previous.y);
          if(distance+segment>=target){end=(i-1+(target-distance)/Math.max(segment,1e-8))/72;break;}
          distance+=segment;
        }
        previous=point;
      }
      const correction=clamp(Math.max((.5-profile.widthScale)/.1,(.8-profile.heightScale)/.22));
      return curve(span+(3.8*end-span)*correction,.105+(drop*end-.105)*correction,profile,unit,unitY);
    }
    speedLines(ctx,box,time,formation,front,profile){
      ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
      const opacity=ctx.globalAlpha;
      const cacheKey=[time,box.x,box.y,box.width,box.height,profile.widthScale,profile.heightScale,profile.swayScale,profile.cohesion,profile.vortexMix].join(':');
      if(this.lineCacheKey!==cacheKey){this.lineCacheKey=cacheKey;this.lineCache=[];}
      // Short, staggered crests wrap around the current curved surface. Their
      // far half is drawn under the volume, not as flat white marks on top.
      for(let i=0;i<22;i++){
        const population=(i<9?1:1-profile.vortexMix)*this.populationWeight(i,22,profile.populationScale);
        if(population<=0)continue;
        const period=.95+hash(i+41)*.9,clock=time/period+hash(i+22),age=clock%1;
        const seed=i*31+Math.floor(clock)*79;
        const headH=.12+.74*hash(seed+3)+.08*age;
        const pulse=smooth(age/.14)*(1-smooth((age-.64)/.36));
        const emerge=smooth((formation-headH)/.16);
        if(pulse*emerge<.01)continue;
        const headAngle=-time*5.2+hash(i+15)*Math.PI*2+.4*Math.sin(headH*5-time*.43);
        const span=.75+hash(seed+5)*1.25,segments=18;
        const points=this.lineCache[i]||(this.lineCache[i]=this.linePoints(box,headH,headAngle,span,time,profile));
        let previous=null;
        for(let j=0;j<=segments;j++){
          const s=j/segments,point=points[j];
          if(previous){
            const depth=(point.z+previous.z)/2;
            if((depth>=0)===front){
              const taper=Math.pow(Math.sin(Math.PI*(s-.5/segments)),.8);
              const alpha=population*pulse*emerge*taper*(front?.22+.48*Math.sqrt(Math.max(0,depth)):.16);
              const width=(.65+hash(seed+7)*.65)*this.detailScale(box,profile)*(.6+.4*taper);
              ctx.beginPath();ctx.moveTo(previous.x,previous.y);ctx.lineTo(point.x,point.y);
              ctx.globalAlpha=opacity*alpha*.18;ctx.lineWidth=width*3.2;
              ctx.strokeStyle='#a4d3d0';ctx.stroke();
              ctx.globalAlpha=opacity*alpha;ctx.lineWidth=width;
              ctx.strokeStyle='#d9e8df';ctx.stroke();
            }
          }
          previous=point;
        }
      }
      ctx.restore();
    }
    debris(ctx,box,time,formation,front,profile){
      const unit=box.width/2,unitY=box.height/2.68,cx=box.x+unit,cy=box.y+box.height/2+.20*unitY;
      for(let i=0;i<34;i++){
        const leaf=i<9;
        const population=(i<22?1:1-profile.vortexMix)*this.populationWeight(leaf?i:i-9,leaf?9:25,profile.populationScale);
        if(population<=0)continue;
        const seed=i*17+11,period=3.5+hash(seed)*3.2;
        const h=(time/period+hash(seed+1))%1;
        const angle=-time*3.4+h*.8+hash(seed+2)*Math.PI*2;
        const mix=clamp(profile.vortexMix),ring=this.ringPoint(angle,time,.96+hash(seed+3)*.22);
        const z=Math.sin(angle)*(1-mix)+clamp(ring.z/.25,-1,1)*mix;if((z>=0)!==front)continue;
        const matureRadius=.12+.55*Math.pow(h,1.4)+hash(seed+3)*.10;
        const looseRadius=this.envelope(h,profile)+.065+hash(seed+3)*.10;
        const radius=(looseRadius+(matureRadius-looseRadius)*(profile.cohesion??1))*profile.widthScale;
        const spine=this.spine(h,time,profile);
        const fx=spine.x+Math.cos(angle)*radius,fy=-.83+h*1.75+(spine.z+Math.sin(angle)*radius)*.105;
        const x=cx+(fx+(ring.x-fx)*mix)*unit;
        const y=cy-(fy+(ring.y+ring.z*.105-fy)*mix)*unitY;
        const alpha=population*smooth(h/.08)*(1-smooth((h-.83)/.17))*smooth((formation-h)/.2)*(.27+.26*(z+1)/2);
        if(alpha<.01)continue;
        ctx.save();ctx.globalAlpha*=alpha;ctx.translate(x,y);
        ctx.rotate(angle*.7+Math.sin(time*3+seed));
        // Larger silhouettes stay readable beside the dense funnel; retain
        // the existing per-piece variation, leaf folding and depth scaling.
        const size=2*(leaf?1.2+hash(seed+4)*1.3:.45+hash(seed+4)*.7)*this.detailScale(box,profile)*(.78+.22*z);
        ctx.fillStyle=leaf?(i%3===0?'#b8b592':'#8aab9e'):'#b5c7c7';
        if(leaf){
          const fold=.25+.75*Math.abs(Math.sin(time*4.2+seed));
          ctx.scale(1,fold);ctx.beginPath();ctx.moveTo(-size*1.6,0);
          ctx.quadraticCurveTo(0,-size,size*1.6,0);ctx.quadraticCurveTo(0,size*.65,-size*1.6,0);ctx.fill();
        }else{ctx.beginPath();ctx.ellipse(0,0,size*1.8,size*.5,0,0,Math.PI*2);ctx.fill();}
        ctx.restore();
      }
    }
    sparkleFrames(box,time,speed,formation=1,profile=root.WindRankEffects.forRank('SS'),clockAt=null,options={}){
      const emerge=smooth((formation-.55)/.45);
      if(!emerge||!box||!Number.isFinite(time)||time<0)return [];
      const viewportWidth=options.viewportWidth??this.viewportWidth??390;
      const viewportHeight=options.viewportHeight??this.viewportHeight??844;
      const mana=Number.isFinite(options.mana)?options.mana:root.FireRankSparkles.manaForRank(profile.rank);
      const shared=root.FireRankSparkles.samples({time,mana,
        referenceWidth:root.FireRankSparkles.referenceWidth(viewportWidth,viewportHeight)});
      const unit=box.width/2,unitY=box.height/2.68,cx=box.x+unit,cy=box.y+box.height/2+.20*unitY;
      const scale=clamp(unit/183.45,.45,1.35),frames=[];
      for(const sparkle of shared){
        // Fire owns population, size and one-second life. Wind still places
        // each birth on its own moving surface and draws near/far layers.
        const {id:i,seed,birth,age}=sparkle,h=.12+hash(seed+5)*.66;
        const birthTime=clockAt?clockAt(birth):birth*speed;
        const orbit=hash(seed+3)*Math.PI*2-birthTime*1.1;
        const z=Math.sin(orbit),spine=this.spine(h,birthTime,profile);
        const radial=(.18+.60*Math.pow(h,1.4)+hash(seed+9)*.10)*profile.widthScale;
        const rise=(24+hash(i+13)*18)*scale;
        const startX=cx+(spine.x+Math.cos(orbit)*radial)*unit;
        const startY=cy-(-.83+h*1.75+(spine.z+z*radial)*.105)*unitY;
        frames.push({...sparkle,front:z>=0,
          x:startX+Math.sin(age*Math.PI*.7)*(z>=0?1:-1)*8*scale,
          y:startY-age*rise,
          alpha:sparkle.alpha*emerge*(z>=0?.72:.42),
          color:['#bdeedd','#c4eff5','#f3fff9'][i%3]});
      }
      return frames;
    }
    flashFrame(time,visualTime,profile,formation=1){
      const gain=clamp(profile.stormFlash||0)*smooth((formation-.8)/.2);
      const dark={cloud:[0,0,0,0],funnel:[0,0,0,0]};
      if(!gain||!Number.isFinite(time)||time<0)return dark;
      // A seeded storm has irregular pauses, a soft first discharge and an
      // occasional shorter echo. Host seconds keep the flash readable while
      // the wind itself follows its separate integrated velocity.
      const cycle=Math.floor(time/2.6),seed=cycle*29+191;
      const start=cycle*2.6+.30+hash(seed)*.65;
      const pulse=(age,length)=>smooth(age/.035)*(1-smooth((age-length*.30)/(length*.70)));
      const cloudAge=time-start,cloudLength=.24+hash(seed+1)*.13;
      const echoDelay=.19+hash(seed+2)*.14;
      const cloudPulse=Math.max(pulse(cloudAge,cloudLength),
        hash(seed+3)>.20?.72*pulse(cloudAge-echoDelay,.16):0);
      const h=.32+hash(seed+6)*.43,axis=this.spine(h,visualTime,profile);
      const funnelAge=time-start-.12-hash(seed+5)*.18;
      // A second, weaker discharge further down the column between cloud
      // bursts makes the two volumes feel connected without a visible bolt.
      const funnelPulse=Math.max(pulse(funnelAge,.29),.76*pulse(time-start-1.05,.24));
      return {
        cloud:[(hash(seed+4)-.5)*1.6,.72+hash(seed+7)*.13,-.18,cloudPulse*gain],
        funnel:[axis.x,-.86+h*1.78,axis.z-.04,funnelPulse*gain]
      };
    }
    draw(ctx,_background,width,height,frame={}){
      if(!this.init())return false;
      frame=frame||{};
      const effects=frame.windEffects;
      const profile=effects?.profile||frame.profile||root.WindRankEffects.forRank(frame.rank);
      const box=frame.box||this.layout(width,height,profile);
      if(!(box.width>0&&box.height>0))return false;
      const time=Number.isFinite(frame.time)?Math.max(0,frame.time):0;
      // Playback rate is separate from the host clock, so the shared 30 fps
      // budget and reveal phase durations are unchanged by the preview speed.
      const playbackRate=Number.isFinite(frame.playbackRate)?clamp(frame.playbackRate,.1,3):1;
      const formation=clamp(frame.formation??1),opacity=clamp(frame.opacity??1);
      // The funnel keeps its original size; only the drawing window expands
      // to the viewport edges so the storm ceiling can continue off screen.
      const cloudBox={x:0,y:0,width,height:Math.max(1,Math.min(height,box.y+box.height+12))};
      const unit=box.width/2,unitY=box.height/2.68,cx=box.x+unit,cy=box.y+box.height/2+.20*unitY;
      const field=[-cx/unit,(cy-cloudBox.height)/unitY,cloudBox.width/unit,cloudBox.height/unitY];
      const scale=Math.min(1.25,root.devicePixelRatio||1,640/cloudBox.width,600/cloudBox.height);
      const pw=Math.max(1,Math.round(cloudBox.width*scale)),ph=Math.max(1,Math.round(cloudBox.height*scale));
      const key=[pw,ph,formation,playbackRate,profile.rank,profile.widthScale,profile.swayScale,profile.cloudAmount,profile.vortexMix,profile.stormFlash,profile.populationScale,profile.cohesion,effects?.value,...field].join(':');
      const backdropTime=(Number.isFinite(effects?.time)?effects.time:time*profile.speed)*playbackRate;
      const visualTime=backdropTime*VISUAL_SPEED;
      const elapsed=time-this.lastTime;
      const resized=this.viewportWidth!==width||this.viewportHeight!==height;
      // A continuously changing rank must not bypass the 30 fps volume budget.
      // Keep its matching box and overlays with the retained volume until the
      // next sample. A resize/replay still refreshes immediately.
      const refresh=time<this.lastTime||elapsed>=1/30-1e-6||resized||!this.renderBox||
        (!effects&&key!==this.lastKey)||
        (effects&&elapsed===0&&key!==this.lastKey);
      if(refresh){
        if(this.canvas.width!==pw||this.canvas.height!==ph){
          this.canvas.width=this.patch.width=pw;this.canvas.height=this.patch.height=ph;
        }
        const gl=this.gl;gl.viewport(0,0,pw,ph);gl.useProgram(this.program);
        gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.enableVertexAttribArray(this.position);
        gl.vertexAttribPointer(this.position,2,gl.FLOAT,false,0,0);
        gl.uniform1f(this.uniforms.uTime,visualTime);gl.uniform4f(this.uniforms.uField,...field);
        gl.uniform1f(this.uniforms.uFormation,formation);
        gl.uniform4f(this.uniforms.uShape,profile.widthScale,profile.swayScale,profile.cloudAmount,profile.vortexMix);
        gl.uniform1f(this.uniforms.uCohesion,profile.cohesion??1);
        const flashes=this.flashFrame(time,visualTime,profile,formation);
        gl.uniform4f(this.uniforms.uCloudFlash,...flashes.cloud);
        gl.uniform4f(this.uniforms.uFunnelFlash,...flashes.funnel);
        gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.drawArrays(gl.TRIANGLES,0,6);
        this.patchCtx.clearRect(0,0,pw,ph);this.patchCtx.drawImage(this.canvas,0,0);
        this.lastTime=time;this.lastKey=key;this.drawCount++;
        this.renderBox={...box};this.cloudBox=cloudBox;this.profile=profile;
        this.playbackRate=playbackRate;this.visualTime=visualTime;
        this.backdropTime=backdropTime;this.backdropReadout=frame.readout?{...frame.readout}:undefined;
        this.flashes=flashes;
        this.viewportWidth=width;this.viewportHeight=height;this.formation=formation;
        this.sparkleMana=Number.isFinite(effects?.value)?effects.value:undefined;
        this.clockAt=effects?.timeAt?birth=>effects.timeAt(birth)*VISUAL_SPEED*playbackRate:null;
      }
      this.time=time;
      ctx.save();ctx.globalCompositeOperation='source-over';ctx.globalAlpha=opacity;
      const renderedProfile=this.profile,renderedBox=this.renderBox,renderedFormation=this.formation;
      // The pulse uses integrated wind velocity without the volume's extra
      // 1.5x swirl multiplier. Retaining this sample also freezes a paused
      // backdrop and keeps it inside the shared 30 fps rendering budget.
      const focusWidth=Math.min(renderedBox.width*.7,width*(.36+.14*clamp(renderedProfile.widthScale)));
      const focusHeight=Math.min(renderedBox.height*.78,height*.66);
      const ground=renderedBox.y+renderedBox.height/2+1.05*renderedBox.height/2.68;
      const focus={x:renderedBox.x+(renderedBox.width-focusWidth)/2,y:ground-focusHeight,
        width:focusWidth,height:focusHeight};
      const backdropDrawn=this.stormBackdrop?.draw(ctx,width,height,{time:this.backdropTime,hostTime:this.lastTime,
        strength:.20+clamp((renderedProfile.speed-.3)/.7),opacity:smooth(renderedFormation),
        focus,readout:this.backdropReadout});
      if(!backdropDrawn)this.backdrop(ctx,width,height,smooth(renderedFormation));
      const speed=VISUAL_SPEED*this.playbackRate*renderedProfile.speed,renderedTime=this.visualTime;
      const sparkles=this.sparkleFrames(renderedBox,this.lastTime,speed,renderedFormation,renderedProfile,this.clockAt,
        {mana:this.sparkleMana,viewportWidth:width,viewportHeight:height});
      root.FireRankSparkles.drawFrames(ctx,sparkles.filter(p=>!p.front),opacity);
      this.speedLines(ctx,renderedBox,renderedTime,renderedFormation,false,renderedProfile);
      this.debris(ctx,renderedBox,renderedTime,renderedFormation,false,renderedProfile);
      ctx.drawImage(this.patch,this.cloudBox.x,this.cloudBox.y,this.cloudBox.width,this.cloudBox.height);
      this.speedLines(ctx,renderedBox,renderedTime,renderedFormation,true,renderedProfile);
      this.debris(ctx,renderedBox,renderedTime,renderedFormation,true,renderedProfile);
      root.FireRankSparkles.drawFrames(ctx,sparkles.filter(p=>p.front),opacity);
      ctx.restore();return true;
    }
    dispose(){
      if(this.disposed)return;
      this.disposed=true;
      this.canvas.removeEventListener('webglcontextlost',this.onLost);
      this.canvas.removeEventListener('webglcontextrestored',this.onRestored);
      if(this.gl&&!this.lost){this.gl.deleteProgram(this.program);this.gl.deleteBuffer(this.buffer);}
      this.program=null;this.buffer=null;this.gl=null;this.lastTime=-Infinity;
      this.stormBackdrop?.dispose();this.stormBackdrop=null;this.backdropReadout=undefined;
      this.lineCache=null;this.lineCacheKey='';
      this.canvas.width=this.canvas.height=this.patch.width=this.patch.height=1;
    }
  }
  root.WindTornadoRenderer=WindTornadoRenderer;
})(globalThis);
