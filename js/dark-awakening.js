/* Dark awakening: a light-consuming core opens into the demon wing root.
 * Pure host-clock sampling keeps pause, hidden tabs and replay deterministic. */
(function(root){
 'use strict';
 const TAU=Math.PI*2,clamp=v=>Math.max(0,Math.min(1,v));
 const smooth=v=>{v=clamp(v);return v*v*(3-2*v);};
 const seed=n=>{const v=Math.sin(n*127.1+83.7)*43758.5453;return v-Math.floor(v);};
 function sample(elapsed){
  const time=Math.max(0,Number.isFinite(elapsed)?elapsed:0);
  const charge=smooth(time/.45),opening=smooth((time-1.05)/.85);
  const handoff=smooth((time-1.9)/.8),live=1-handoff;
  return {time,charge,opening,handoff,live,
   phase:time<.45?'暗核吞光':time<1.05?'闇流凝聚':time<1.9?'魔力覺醒':'魔翼顯現'};
 }
 function glow(ctx,x,y,radius,stops,alpha=1){
  if(radius<=0||alpha<=0)return;
  const gradient=ctx.createRadialGradient(x,y,0,x,y,radius);
  for(const [at,color]of stops)gradient.addColorStop(at,color);
  ctx.globalAlpha=alpha;ctx.fillStyle=gradient;
  ctx.fillRect(x-radius,y-radius,radius*2,radius*2);
 }
 function draw(ctx,{width,height,elapsed=0,target,layer='all'}={}){
  if(!ctx||!(width>0&&height>0))return;
  const s=sample(elapsed);if(s.live<=0)return;
  const unit=Math.min(width,height),cx=target?.x??width*.5,cy=target?.y??height*.4;
  const reach=Math.hypot(Math.max(cx,width-cx),Math.max(cy,height-cy));
  const chargeLight=smooth((s.time-.18)/.7),pulse=1+Math.sin(s.time*11)*.045+Math.sin(s.time*19)*.025;
  ctx.save();ctx.globalCompositeOperation='source-over';
  if(layer!=='foreground'){
   // Match the existing wing renderer's backdrop before it fades in. This
   // prevents the portal from reappearing between two translucent layers.
   const bg=ctx.createLinearGradient(0,0,0,height);
   bg.addColorStop(0,'#090b16');bg.addColorStop(.52,'#150d20');bg.addColorStop(1,'#080b14');
   ctx.globalAlpha=layer==='background'?1:smooth(s.time/.24);ctx.fillStyle=bg;ctx.fillRect(0,0,width,height);
   glow(ctx,cx,cy,unit*(.32+.5*s.opening),[[0,'#58438188'],[.38,'#30245155'],[1,'#17112300']],(.45+chargeLight*.35)*(layer==='background'?1:s.live));
  }
  if(layer==='background'){ctx.restore();return;}
  // A compact, soft void rather than a drawn circle or a seal. Separate
  // lobes of reflected purple light move around its uneven silhouette.
  const coreRadius=unit*(.022+.036*s.charge)*(1-.58*s.opening);
  ctx.globalCompositeOperation='screen';
  for(let i=0;i<7;i++){
   const angle=i*TAU/7+s.time*(.27+seed(i)*.5),r=coreRadius*(1.2+seed(i+11)*.5);
   glow(ctx,cx+Math.cos(angle)*r,cy+Math.sin(angle)*r*.78,coreRadius*(1.5+seed(i+34)),
    [[0,'#8e71cd55'],[.3,'#5747a138'],[1,'#3f397c00']],chargeLight*(1-s.opening)*s.live);
  }
  ctx.globalCompositeOperation='source-over';
  glow(ctx,cx,cy,coreRadius*2.3,[[0,'#02030aff'],[.35,'#03040df5'],[.65,'#050611aa'],[1,'#05061100']],s.charge*(1-s.opening)*s.live);
  // Curved volumes inhale tangentially. At release, the same continuous
  // paths stretch into two broad shoulders in the direction of the wings.
  for(let i=0;i<12;i++){
   const side=i%2?-1:1,k=seed(i+52),rise=seed(i+77),gate=smooth((s.time-.24-k*.18)/.4)*s.live;
   if(gate<=0)continue;
   const turn=s.time*(.8+k*.4)+i*.43;
   const span=unit*(.12+k*.18+s.opening*(.28+k*.2));
   const endX=side*span,endY=-unit*(.02+rise*.21)*(.6+s.opening*.4);
   const curl=unit*(.025+.055*Math.sin(turn))*(1-s.opening);
   const breadth=unit*(.008+rise*.016)*(1+s.opening*1.6);
   ctx.save();ctx.translate(cx,cy);ctx.globalCompositeOperation='screen';
   const g=ctx.createLinearGradient(0,0,endX,endY);
   g.addColorStop(0,'#d5c7ff70');g.addColorStop(.2,'#8b75b94a');g.addColorStop(.62,'#50639126');g.addColorStop(1,'#6c598a00');
   ctx.fillStyle=g;
   for(const [spread,opacity]of [[3.2,.16],[1.6,.23],[.7,.24]]){
    const b=breadth*spread;ctx.globalAlpha=gate*opacity*(.7+.3*Math.sin(turn*.8)**2);
    ctx.beginPath();ctx.moveTo(0,0);
    ctx.bezierCurveTo(side*span*.25,-unit*.04-curl,side*span*.64,endY-b,endX,endY);
    ctx.bezierCurveTo(side*span*.68,endY+b,side*span*.2,unit*.04+curl,0,0);ctx.fill();
   }
   ctx.restore();
  }
  ctx.globalCompositeOperation='screen';
  // Opening pulse has a broad feathered edge; it crosses the frame once.
  const wave=clamp((s.time-1.14)/1.25);
  if(wave>0&&wave<1){
   const radius=unit*.04+reach*(1-(1-wave)**2),band=unit*(.07+.12*wave);
   const g=ctx.createRadialGradient(cx,cy,Math.max(0,radius-band),cx,cy,radius+band);
   g.addColorStop(0,'#887ac500');g.addColorStop(.45,'#a390e541');g.addColorStop(.62,'#8b7ecc24');g.addColorStop(1,'#7362b800');
   ctx.globalAlpha=Math.sin(wave*Math.PI)*s.live;ctx.fillStyle=g;ctx.fillRect(0,0,width,height);
  }
  // Suspended dust spirals inward, then takes unequal curved outward paths.
  // Near fragments are softer/larger; none reveal the eventual rank.
  for(let i=0;i<52;i++){
   const depth=seed(i+201),birth=seed(i+234)*.24,phase=(s.time*.48+seed(i+298))%1;
   const angle=i*2.399963+s.time*(.24+depth*.4);
   const inward=unit*(.025+(1-phase)*(.18+depth*.28));
   const out=unit*(.06+Math.max(0,s.time-1.05-birth)*(.38+depth*.6));
   const radius=inward*(1-s.opening)+out*s.opening;
   const x=cx+Math.cos(angle)*radius,y=cy+Math.sin(angle)*radius*.72;
   const alpha=Math.sin(phase*Math.PI)*(.24+depth*.42)*chargeLight*s.live;
   glow(ctx,x,y,(1.1+depth*2.7)*Math.max(.7,unit/390),[[0,'#d3cbf2d0'],[.24,'#a998d790'],[1,'#7264ac00']],alpha);
  }
  // The inner slit lengthens before unfurling sideways. Its white-violet
  // center becomes the existing material's wing-root light during FORM.
  const fissure=smooth((s.time-.42)/.5)*(1-s.handoff);
  ctx.save();ctx.translate(cx,cy);ctx.scale(.24+s.opening*1.6,1-s.opening*.6);
  glow(ctx,0,0,unit*(.04+chargeLight*.07)*pulse,[[0,'#e8dcfff0'],[.07,'#b3a5efb0'],[.3,'#6653a84a'],[1,'#30205100']],fissure*.9);ctx.restore();
  glow(ctx,cx,cy,unit*(.1+.20*s.opening),[[0,'#c8b7fa80'],[.14,'#927cd13a'],[.5,'#5b478d19'],[1,'#46347900']],chargeLight*s.live*pulse);
  glow(ctx,cx,cy,unit*(.009+s.opening*.015),[[0,'#f0e9ffed'],[.15,'#baa6f4b0'],[.5,'#7664c150'],[1,'#594b9400']],fissure*s.live);
  ctx.restore();
 }
 root.DarkAwakening=Object.freeze({sample,draw,duration:1.9,totalDuration:2.7});
})(globalThis);
