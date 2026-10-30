const fs=require('node:fs');
const {createCanvas}=require('C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
for(const name of ['config','effect-settings','ribbon-renderer','finger-trails','portal-scene','reveal-flow','reveal-gather','reveal-atmosphere'])require('../js/'+name+'.js');
const w=390,h=844,canvas=createCanvas(w,h),ctx=canvas.getContext('2d');
const scene=new PortalScene(ctx,w,h,()=>createCanvas(1,1)),flow=new RevealFlow(),atmosphere=new RevealAtmosphere(),gather=new RevealGather();
scene.down(1,100,450,0);flow.down(1,100,450);
for(let i=0;i<=70;i++){
 const a=i/70*Math.PI*3,x=195+Math.sin(a)*95,y=150+i*6;
 scene.move(1,x,y,i*16);flow.move(1,x,y);scene.step(.016);
}
scene.release(1);flow.up(1);
const sheet=createCanvas(w*3,(h+40)*2),sc=sheet.getContext('2d');let clock=0;
const frames=[[0,'RELEASE / LIVE RIBBON'],[1.12,'PERIMETER INHALE'],[1.75,'SHARED OUTWARD BURST'],[2.45,'LIVING OUTER DRIFT'],[3.03,'SHARED INWARD RETURN'],[3.3,'ARRIVAL / CLEAR CENTRE']];
for(let i=0;i<frames.length;i++){
 const [until,label]=frames[i];
 while(clock<until-1e-9){
  const dt=Math.min(.016,until-clock),before=flow.state;
  scene.step(dt*(before==='WAITING'?1:.35),{freezeTrails:before!=='WAITING',holdTrails:before==='WAITING'});
  flow.step(dt);atmosphere.step(dt,flow);
  if(before!=='GATHER'&&flow.state==='GATHER')gather.capture(scene.trails,w,h);
  clock+=dt;
 }
 const target={x:w/2,y:h/2},transform=(q,kind)=>atmosphere.point(q,kind,w,h,target);
 scene.draw(null,{transform,trails:flow.state==='WAITING'});
 if(flow.state==='GATHER')gather.draw(ctx,{progress:flow.progress,width:w,height:h,target,time:flow.elapsed});
 fs.writeFileSync(__dirname+'/atmosphere-frame-'+i+'.png',canvas.toBuffer('image/png'));
 const x=i%3*w,y=Math.floor(i/3)*(h+40);sc.fillStyle='#080915';sc.fillRect(x,y,w,h+40);sc.fillStyle='#ded4e9';sc.font='14px sans-serif';sc.fillText(label,x+12,y+25);sc.drawImage(canvas,x,y+40);
}
fs.writeFileSync(__dirname+'/atmosphere-gather-contact.png',sheet.toBuffer('image/png'));
