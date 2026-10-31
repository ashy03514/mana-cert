/* Dark opening: illuminated surroundings are consumed by an opaque core,
 * then emit black-violet fire. All motion samples the host's active clock. */
(function(root){
 'use strict';
 const TAU=Math.PI*2,clamp=v=>Math.max(0,Math.min(1,v));
 const smooth=v=>{v=clamp(v);return v*v*(3-2*v);};
 const seed=n=>{const v=Math.sin(n*127.1+83.7)*43758.5453;return v-Math.floor(v);};
 let flameRenderer=null;
 function sample(elapsed){
  const time=Math.max(0,Number.isFinite(elapsed)?elapsed:0);
  const charge=smooth(time/.32),absorb=smooth((time-.30)/1.50);
  const illumination=charge*(1-smooth((time-.50)/1.30));
  const flame=smooth((time-1.90)/.38),handoff=smooth((time-3.2)/.8);
  return {time,charge,absorb,illumination,flame,opening:flame,handoff,live:1-handoff,
   phase:time<.32?'光霧浮現':time<1.90?'黑洞吞光':time<2.5?'黑焰迸發':time<3.2?'黑焰凝核':'魔翼顯現'};
 }
 function prepare(){
  if(flameRenderer)return !flameRenderer.error;
  if(!root.ElementMaterialRenderer||!root.ElementMaterialSources?.fire)return false;
  // Reuse the approved volumetric flame, including its flowing tongue tips,
  // gas-driven formation and rounded fuel bed. Only its emitted color changes.
  root.ElementMaterialSources.darkAwakeningFlame=root.ElementMaterialSources.fire.replace('vec4 material(', 'vec4 flameVolume(')+
   'vec4 material(vec2 p,float t){vec4 f=flameVolume(p,3.+t*2.5);float heat=clamp(max(f.r,max(f.g,f.b)),0.,1.);'+
   'vec3 violet=mix(vec3(.12,.014,.27),vec3(.66,.22,.95),smoothstep(.10,.66,heat));'+
   'float dense=smoothstep(.72,.96,heat);violet=mix(violet,vec3(.022,.008,.035),dense*.96);'+
   'return vec4(violet,f.a);}';
  flameRenderer=new root.ElementMaterialRenderer();flameRenderer.element='darkAwakeningFlame';
  return flameRenderer.init()&&!!flameRenderer.compile('darkAwakeningFlame');
 }
 function dispose(){flameRenderer?.dispose();flameRenderer=null;}
 function glow(ctx,x,y,radius,stops,alpha=1){
  if(radius<=0||alpha<=0)return;
  const g=ctx.createRadialGradient(x,y,0,x,y,radius);
  for(const [at,color]of stops)g.addColorStop(at,color);
  ctx.globalAlpha=Math.min(1,alpha);ctx.fillStyle=g;ctx.fillRect(x-radius,y-radius,radius*2,radius*2);
 }
 function infall(index,time,width,height,cx,cy,cloud=false){
  const depth=seed(index+217),angle=index*2.399963+seed(index+46)*.3;
  const start=.22+seed(index+81)*.68,duration=.52+seed(index+124)*.42;
  const q=clamp((time-start)/duration),turn=q*q*(1.3+depth*.6);
  const dx=Math.cos(angle)*width*(.44+depth*.40),dy=Math.sin(angle)*height*(.40+depth*.32);
  const r=Math.hypot(dx,dy),base=Math.atan2(dy,dx),unit=Math.min(width,height);
  const horizon=unit*.074,distance=horizon+r*Math.pow(1-q*q,.83);
  return {x:cx+Math.cos(base+turn)*distance,y:cy+Math.sin(base+turn)*distance,
   alpha:smooth(time/.24)*(1-smooth((q-.88)/.12)),q,depth,
   size:cloud?unit*(.13+depth*.19):(.75+depth*2.5)*Math.max(.7,unit/390)};
 }
 function flamePose({width,height,elapsed=0,target,art,growth=0}={}){
  const s=sample(elapsed),unit=Math.min(width,height),g=Number.isFinite(growth)?Math.max(0,Math.min(2,growth)):0;
  const center=target||{x:width*.5,y:height*.4};
  const a=art||{w:unit*.72,cx:center.x,cy:center.y};
  const compact=a.w*(.24+g*.07),contract=smooth((s.time-2.5)/.7);
  const size=unit*1.22+(compact-unit*1.22)*contract;
  const x=center.x+(a.cx-center.x)*contract;
  const y=center.y+(a.cy+compact*.20-center.y)*contract;
  return {x,y,size,time:Math.max(0,s.time-1.9),formation:s.flame,contract,
   opacity:smooth((s.time-1.9)/.10),growth:g,
   box:{x:x-size/2,y:y-size*1.23/2-size*.33,width:size,height:size*1.23}};
 }
 function drawFlame(ctx,args={}){
  const pose=flamePose(args);if(!ctx||pose.opacity<=0||!prepare())return pose;
  const {width,height}=args;
  ctx.save();ctx.globalCompositeOperation='screen';
  glow(ctx,pose.x,pose.y-pose.size*.20,pose.size*.52,
   [[0,'#71358b50'],[.4,'#50216a24'],[1,'#29133e00']],pose.opacity*(.7+pose.growth*.15));
  ctx.restore();
  flameRenderer.draw(ctx,ctx.canvas,width,height,{box:pose.box,time:pose.time,
   formation:pose.formation,phase:.5,opacity:pose.opacity});
  return pose;
 }
 function draw(ctx,{width,height,elapsed=0,target,layer='all',includeFlame=true,art,growth=0}={}){
  if(!ctx||!(width>0&&height>0))return;
  const s=sample(elapsed);if(s.live<=0)return;
  const unit=Math.min(width,height),cx=target?.x??width*.5,cy=target?.y??height*.4;
  const reach=Math.hypot(Math.max(cx,width-cx),Math.max(cy,height-cy));
  ctx.save();ctx.globalCompositeOperation='source-over';
  if(layer!=='foreground'){
   const bg=ctx.createLinearGradient(0,0,0,height);
   bg.addColorStop(0,'#090b16');bg.addColorStop(.52,'#150d20');bg.addColorStop(1,'#080b14');
   ctx.globalAlpha=layer==='background'?1:smooth(s.time/.20);ctx.fillStyle=bg;ctx.fillRect(0,0,width,height);
   // The luminous atmosphere physically contracts, exposing dark space from
   // the edges inward. The black core remains in front of the illuminated field.
   const lightRadius=reach*(1.48-1.35*s.absorb);
   glow(ctx,cx,cy,lightRadius,[[0,'#a2abc7e8'],[.34,'#858eaff0'],[.7,'#526580d0'],[1,'#263c5800']],s.illumination*.84);
   ctx.globalCompositeOperation='screen';
   for(let i=0;i<30;i++){
    const p=infall(i+340,s.time,width,height,cx,cy,true);
    glow(ctx,p.x,p.y,p.size*(1-p.q*.64),[[0,'#a5b5db45'],[.35,'#92a0c42c'],[1,'#5c6e9c00']],p.alpha*.72);
   }
   glow(ctx,cx,cy,unit*.54,[[0,'#7b379879'],[.4,'#54227834'],[1,'#25103a00']],s.flame*(layer==='background'?1:s.live));
  }
  if(layer==='background'){ctx.restore();return;}
  // Heads accelerate along a curved path; their tails sample earlier points
  // on that same path. They disappear into the horizon, with no looping reset.
  ctx.globalCompositeOperation='screen';
  for(let i=0;i<172;i++){
   const p=infall(i,s.time,width,height,cx,cy);if(p.alpha<.003)continue;
   const tail=infall(i,Math.max(0,s.time-.04-p.depth*.035),width,height,cx,cy);
   if(p.q>0){
    const g=ctx.createLinearGradient(tail.x,tail.y,p.x,p.y);
    g.addColorStop(0,'#aabde900');g.addColorStop(1,'#e3eaffce');
    ctx.globalAlpha=p.alpha*(.42+p.depth*.35);ctx.strokeStyle=g;ctx.lineWidth=Math.max(.55,p.size*.7);ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(tail.x,tail.y);ctx.lineTo(p.x,p.y);ctx.stroke();
   }
   glow(ctx,p.x,p.y,p.size*3.1,[[0,'#eff1fff0'],[.12,'#cbd7ffdc'],[.4,'#9bade954'],[1,'#7d93d000']],p.alpha);
  }
  const consumed=smooth((s.time-1.74)/.22),hole=s.charge*(1-consumed);
  const radius=unit*(.038+.050*s.charge)*(1-.40*smooth((s.time-1.60)/.30));
  if(hole>0){
   // Shredded accretion light, never a white light source at the center.
   glow(ctx,cx,cy,radius*3.3,[[0,'#7465a000'],[.24,'#a996e480'],[.45,'#6c70b63c'],[1,'#45477c00']],hole*.9);
   for(let i=0;i<11;i++){
    const spin=s.time*(1.6+seed(i+9)*1.4),angle=i*TAU/11+spin;
    const rr=radius*(1.13+seed(i+15)*.48),x=cx+Math.cos(angle)*rr,y=cy+Math.sin(angle)*rr*.72;
    ctx.save();ctx.translate(x,y);ctx.rotate(angle+Math.PI/2);ctx.scale(1.7,.6);
    glow(ctx,0,0,radius*.46,[[0,'#d5ccf49a'],[.3,'#9f94cf60'],[1,'#62609b00']],hole*.78);ctx.restore();
   }
   ctx.globalCompositeOperation='source-over';
   glow(ctx,cx,cy,radius*1.18,[[0,'#010108ff'],[.74,'#010108ff'],[.89,'#02020cf5'],[1,'#03030b00']],hole);
  }
  if(includeFlame)drawFlame(ctx,{width,height,elapsed,target,art,growth});
  // Cooling fragments peel off after ignition, with independent rising speed.
  ctx.globalCompositeOperation='screen';
  for(let i=0;i<30;i++){
   const age=s.time-1.97-seed(i+80)*.32;if(age<0||age>1.35)continue;
   const depth=seed(i+91),angle=-Math.PI/2+(seed(i+120)-.5)*2.3;
   const r=unit*(.08+age*(.22+depth*.22));
   const x=cx+Math.cos(angle)*r+Math.sin(age*5+i)*unit*.016,y=cy+Math.sin(angle)*r;
   glow(ctx,x,y,(1+depth*2.3)*Math.max(.7,unit/390),[[0,'#c3a0f1cc'],[.25,'#9658ce88'],[1,'#5b238d00']],Math.sin(age/1.35*Math.PI)*s.live*.8);
  }
  ctx.restore();
 }
 root.DarkAwakening=Object.freeze({sample,draw,drawFlame,flamePose,infall,prepare,dispose,duration:3.2,totalDuration:4.0,
  get error(){return flameRenderer?.error||'';},get lost(){return flameRenderer?.lost||false;}});
})(globalThis);
