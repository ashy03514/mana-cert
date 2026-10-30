/* Registered membrane growth: fixed texture coordinates, a root-out luminous
 * reveal, then exposure settling. No contour stretching between rank images. */
(function(root){
 'use strict';
 const clamp=v=>Math.max(0,Math.min(1,v)),smooth=v=>{v=clamp(v);return v*v*(3-2*v);};
 const offsets={A:-.09,S:-.05,SS:0};
 const vertex=`attribute vec2 aPosition,aUv;uniform vec2 uResolution;varying vec2 vUv;
 void main(){vUv=aUv;gl_Position=vec4(aPosition.x/uResolution.x*2.-1.,1.-aPosition.y/uResolution.y*2.,0.,1.);}`;
 const fragment=`precision highp float;varying vec2 vUv;
 uniform sampler2D uYoung,uMature;uniform float uProgress,uYoungOffset,uMatureOffset,uExposure,uLight,uClock,uGlow,uRadius,uOpacity;
 vec4 safe(sampler2D image,vec2 p){if(p.x<0.||p.x>1.||p.y<0.||p.y>1.)return vec4(0.);return texture2D(image,p);}
 float reach(vec2 p){return clamp(length(vec2(p.x-.5,(p.y-.43)*.6667))/.55,0.,1.);}
 float phase(vec2 p){float front=.10+reach(p)*.75;return smoothstep(front-.075,front+.075,uProgress);}
 float retire(vec2 p){float front=.72+reach(p)*.20;return smoothstep(front-.06,front+.06,uProgress);}
 vec4 read(vec2 uv){
  float f=phase(uv);vec4 young=safe(uYoung,uv-vec2(0.,uYoungOffset));
  vec4 mature=safe(uMature,uv-vec2(0.,uMatureOffset))*f;
  mature.rgb=mix(mature.rgb,vec3(.84,.84,1.)*mature.a,uExposure*.94);
  vec4 color=mature+young*(1.-mature.a)*(1.-retire(uv));
  float seam=4.*f*(1.-f),glint=.86+.14*sin(uClock*5.1+uv.y*39.+uv.x*23.);
  color.rgb=mix(color.rgb,vec3(.83,.80,1.)*color.a,seam*glint);
  return vec4(color.rgb*uLight,color.a);
 }
 float halo(vec2 uv){float f=phase(uv),a=safe(uMature,uv-vec2(0.,uMatureOffset)).a;
  return uGlow>1.5?a*f*uExposure:max(a,safe(uYoung,uv-vec2(0.,uYoungOffset)).a)*4.*f*(1.-f);}
 void main(){
  if(uGlow<.5){gl_FragColor=read(vUv)*uOpacity;return;}
  vec2 d=vec2(uRadius,uRadius*1.5);float a=halo(vUv)*.2;
  a+=(halo(vUv+vec2(d.x,0.))+halo(vUv-vec2(d.x,0.))+halo(vUv+vec2(0.,d.y))+halo(vUv-vec2(0.,d.y)))*.12;
  a+=(halo(vUv+d)+halo(vUv-d)+halo(vUv+vec2(d.x,-d.y))+halo(vUv+vec2(-d.x,d.y)))*.08;
  a*=uOpacity;gl_FragColor=vec4(vec3(.65,.62,1.)*a,a);
 }`;
 // Attachment landmarks are authored for each image, translated to the same
 // root as the artwork. The chain never scales with a bitmap's bounding box.
 const rankChains={
  S:[[[.342,.205],[.372,.205],[.363,.232]],[[.350,.225],[.330,.540],[.216,.560]],[[.350,.242],[.345,.455],[.450,.410]],[[.342,.205],[.337,.248],[.363,.232]]],
  A:[[[.352,.239],[.378,.239],[.369,.266]],[[.360,.258],[.335,.455],[.265,.480]],[[.360,.272],[.368,.427],[.450,.420]],[[.352,.239],[.347,.280],[.369,.266]]]
 };
 class DarkDemonWingGrowthRenderer extends root.DarkDemonWingMotionRenderer{
  constructor(){
   super();const ssReady=this.ready;this.images={SS:this.image,A:new Image(),S:new Image()};this.rankTextures={};this.rankLoads=[];
   this.ssLoaded=false;this.rankAssetsReady=false;
   Object.defineProperty(this,'loaded',{configurable:true,get:()=>this.ssLoaded&&this.rankAssetsReady,set:value=>{this.ssLoaded=value;}});
   const script=document.currentScript?.src||new URL('js/dark-demon-wing-growth-renderer.js',location.href).href;
   const load=rank=>new Promise(resolve=>{this.rankLoads.push(resolve);const image=this.images[rank];image.onload=()=>resolve(true);image.onerror=()=>{if(!this.disposed)this.fail('闇翼 '+rank+' 素材無法載入');resolve(false);};
    image.src=root.DarkDemonWingRankAssets?.[rank]||new URL('../assets/dark-demon-wings-'+rank.toLowerCase()+'-v1.png',script).href;});
   this.ready=Promise.all([ssReady,load('A'),load('S')]).then(results=>{this.rankAssetsReady=!this.disposed&&!this.error&&results.every(Boolean);return this.loaded;});
  }
  init(){
   if(!this.images||!this.images.A.complete||!this.images.A.naturalWidth||!this.images.S.complete||!this.images.S.naturalWidth)return false;
   const fresh=!this.program;if(!super.init())return false;
   if(fresh){
    this.growthProgram=null;this.rankTextures={SS:this.textures[0]};const gl=this.gl;
    try{
     for(const rank of ['A','S']){const t=gl.createTexture();this.textures.push(t);this.rankTextures[rank]=t;gl.bindTexture(gl.TEXTURE_2D,t);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,this.images[rank]);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);}
     this.growthProgram=this.makeProgram(vertex,fragment);this.gu={};
     for(const key of ['uResolution','uYoung','uMature','uProgress','uYoungOffset','uMatureOffset','uExposure','uLight','uClock','uGlow','uRadius','uOpacity'])this.gu[key]=gl.getUniformLocation(this.growthProgram,key);
     this.ga={position:gl.getAttribLocation(this.growthProgram,'aPosition'),uv:gl.getAttribLocation(this.growthProgram,'aUv')};
     this.chains.forEach((m,i)=>{m.rankCurves={SS:m.curve};for(const rank of ['A','S']){
      const points=rankChains[rank][i%4].map(([x,y])=>[m.side<0?x:1-x,y]);m.rankCurves[rank]=m.curve.map((_,j)=>this.bezier(points,j/m.steps));}});
    }catch(e){this.fail(e);this.release();return false;}
   }return true;
  }
  pair(options){
   const t=options.growthTransition,ranks=['A','S','SS'];
   if(t&&ranks.includes(t.from)&&ranks.includes(t.to)&&Number.isFinite(t.progress))return {...t,progress:clamp(t.progress)};
   if(Number.isFinite(options.growth)){const g=Math.max(0,Math.min(2,options.growth));return g===0?{from:'A',to:'A',progress:1}:g<=1?{from:'A',to:'S',progress:g}:{from:'S',to:'SS',progress:g-1};}
   const rank=ranks.includes(options.rank)?options.rank:'SS';return {from:rank,to:rank,progress:1};
  }
  drawWings(w,h,time,s,pair,exposure){
   const gl=this.gl,u=this.gu;gl.useProgram(this.growthProgram);gl.uniform2f(u.uResolution,w,h);
   gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.rankTextures[pair.from]);gl.uniform1i(u.uYoung,0);
   gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.rankTextures[pair.to]);gl.uniform1i(u.uMature,1);
   gl.uniform1f(u.uYoungOffset,offsets[pair.from]);gl.uniform1f(u.uMatureOffset,offsets[pair.to]);gl.uniform1f(u.uProgress,pair.progress);
   gl.uniform1f(u.uExposure,exposure);gl.uniform1f(u.uLight,1+s.release*.15+Math.sin(time*.75)*.025);gl.uniform1f(u.uClock,time);
   const passes=[];if(exposure>0)passes.push([.024,2,.50]);passes.push([0,0,1]);
   if(pair.progress>0&&pair.progress<1)passes.push([.018,1,.65]);if(exposure>0)passes.push([.006,2,.17]);
   for(const [radius,glow,opacity]of passes){
    gl.blendFunc(gl.ONE,glow?gl.ONE_MINUS_SRC_COLOR:gl.ONE_MINUS_SRC_ALPHA);gl.uniform1f(u.uRadius,radius);gl.uniform1f(u.uGlow,glow);gl.uniform1f(u.uOpacity,opacity);
    for(const m of this.meshes){gl.bindBuffer(gl.ARRAY_BUFFER,m.buffer);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,m.indices);
     gl.enableVertexAttribArray(this.ga.position);gl.vertexAttribPointer(this.ga.position,2,gl.FLOAT,false,16,0);
     gl.enableVertexAttribArray(this.ga.uv);gl.vertexAttribPointer(this.ga.uv,2,gl.FLOAT,false,16,8);gl.drawElements(gl.TRIANGLES,m.count,gl.UNSIGNED_SHORT,0);}
   }gl.activeTexture(gl.TEXTURE0);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
  }
  drawChains(w,h,s,alpha,behind){
   const gl=this.gl;gl.useProgram(this.program);gl.uniform2f(this.resolution,w,h);gl.uniform1i(this.sampler,0);gl.activeTexture(gl.TEXTURE0);
   gl.bindTexture(gl.TEXTURE_2D,this.textures[1]);gl.uniform1f(this.light,behind?.8+s.release*.15:1+s.release*.20);
   gl.uniform1f(gl.getUniformLocation(this.program,'uOpacity'),alpha);
   for(const m of this.chains)if(!!m.spec.behind===behind)this.drawMesh(m);
  }
  draw(ctx,w,h,options={}){
   if(!this.init())return false;
   const pair=this.pair(options),exposure=Number.isFinite(options.growthExposure)?clamp(options.growthExposure):0;
   const time=Number.isFinite(options.motionTime)?Math.max(0,options.motionTime):Math.max(0,options.time||0)*root.DarkDemonWingMotion.profile(pair.to).speed;
   const from=root.DarkDemonWingMotion.sample(time,pair.from),to=root.DarkDemonWingMotion.sample(time,pair.to),s={...to};
   for(const key of ['charge','release','burst','idleStrength','chainStrength','chainOpacity','core','rays'])s[key]=from[key]+(to[key]-from[key])*pair.progress;
   const a=this.layout(w,h,options.box),gl=this.gl,dpr=Math.min(1.5,Math.max(1,ctx.getTransform().a));
   const pw=Math.round(w*dpr),ph=Math.round(h*dpr);if(this.canvas.width!==pw||this.canvas.height!==ph){this.canvas.width=pw;this.canvas.height=ph;}
   this.paintWings(a,time,s);
   const transition=pair.from!==pair.to,chainRank=transition&&pair.progress<.5?pair.from:pair.to;
   // The old attachments dissolve before the new bones reach them; new chain
   // ornaments arrive after the wing silhouette forms instead of sliding.
   const chainFade=transition?(1-smooth(pair.progress/.26))+smooth((pair.progress-.82)/.18):1;
   for(const m of this.chains)m.curve=m.rankCurves[chainRank];
   if(options.chains!==false)this.paintChains(a,time,s);
   gl.viewport(0,0,pw,ph);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
   // Exposure belongs to the arriving wing; an old attachment must retain
   // its settled brightness at progress=0 before its own dissolve begins.
   const chainExposure=transition&&pair.progress<.5?0:exposure;
   const chainAlpha=s.chainOpacity*chainFade*(1-chainExposure*.78);
   if(options.chains!==false)this.drawChains(w,h,s,chainAlpha,true);
   this.drawWings(w,h,time,s,pair,exposure);
   if(options.chains!==false)this.drawChains(w,h,s,chainAlpha,false);
   // Composite the complete layer once, so FORM opacity affects the dark
   // background, mesh, core and particles equally (their helpers set alpha).
   this.stage??=document.createElement('canvas');if(this.stage.width!==pw||this.stage.height!==ph){this.stage.width=pw;this.stage.height=ph;}
   const layer=this.stage.getContext('2d');layer.setTransform(dpr,0,0,dpr,0,0);layer.clearRect(0,0,w,h);
   this.background(layer,w,h,a,s);layer.globalAlpha=s.visible;layer.drawImage(this.canvas,0,0,w,h);layer.globalAlpha=1;this.core(layer,a,s);
   this.particles(layer,a,time,pair.progress<.65?pair.from:pair.to);
   ctx.save();ctx.globalAlpha=clamp(options.opacity??1);ctx.drawImage(this.stage,0,0,w,h);ctx.restore();
   this.layerState={...pair,exposure,mode:'registered-membrane-reveal'};this.lastArt=a;this.lastSample=s;this.drawCount++;return true;
  }
  release(){if(this.gl&&this.growthProgram&&!this.lost)this.gl.deleteProgram(this.growthProgram);this.growthProgram=null;this.rankTextures={};super.release();}
  dispose(){this.rankLoads?.forEach(resolve=>resolve(false));for(const rank of ['A','S'])if(this.images?.[rank])this.images[rank].onload=this.images[rank].onerror=null;super.dispose();this.stage=null;}
 }
 root.DarkDemonWingGrowthRenderer=DarkDemonWingGrowthRenderer;
})(globalThis);
