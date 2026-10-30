const fs=require('node:fs');
const {createCanvas}=require('C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
for(const name of ['config','effect-settings','ribbon-renderer','finger-trails','portal-scene','reveal-atmosphere','reveal-gather'])require('../js/'+name+'.js');
const w=390,h=844,canvas=createCanvas(w,h),ctx=canvas.getContext('2d'),scene=new PortalScene(ctx,w,h,()=>createCanvas(1,1));
const source={width:w,height:h,time:12,settings:EffectSettings.defaults,renderer:new RibbonRenderer(),opacity:()=>1,
 strokes:[{seed:7,color:'#7deaff',points:Array.from({length:140},(_,i)=>({x:195+Math.sin(i*.15)*135,y:422+Math.cos(i*.11)*240,speed:.4}))}]};
const g=new RevealGather();g.capture(source,w,h);const a=new RevealAtmosphere();
const largest=g.flashes.reduce((a,b)=>a.size>b.size?a:b);const peak=largest.start+largest.life*.12;
const sheet=createCanvas(w*3,h),sc=sheet.getContext('2d');
for(let i=0;i<3;i++){
 const p=peak+i*.06/2.1;a.step(0,{state:'GATHER',progress:p});scene.time=p*2.1;scene.orbitTime=p*2.1;scene.positionPools();
 scene.draw(null,{trails:false,transform:(q,k)=>a.point(q,k,w,h),dim:.16*p});g.draw(ctx,{progress:p,time:p*2.1});
 sc.drawImage(canvas,i*w,0);sc.fillStyle='#ddd';sc.font='14px sans-serif';sc.fillText('FLASH + '+(i*60)+' ms',i*w+12,24);
}
fs.writeFileSync(__dirname+'/impact-flashes-contact.png',sheet.toBuffer('image/png'));
console.log({flashCount:g.flashes.length,largestDiameter:largest.size*2,peakSeconds:peak*2.1});
