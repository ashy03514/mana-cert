/* SS seal: one active clock owns pressure, links and impact. */
(function(root){
 'use strict';
 const clamp=x=>Math.max(0,Math.min(1,x)),smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
 const PERIOD=6.6,TAU=Math.PI*2;
 const seed=n=>{const x=Math.sin(n*127.1+13.7)*43758.5453;return x-Math.floor(x);};
 function sample(value){
  const time=Number.isFinite(value)?Math.max(0,value):0,phase=time%PERIOD;
  const charge=smooth((phase-.55)/1.25)*(1-smooth((phase-2.05)/.65));
  const surge=smooth((phase-2.02)/.70)*(1-smooth((phase-2.96)/.55));
  const age=phase-3.10,impact=age<0?0:smooth(age/.045)*Math.exp(-age*5.5);
  const recoil=age<0?0:Math.sin(age*23)*Math.exp(-age*4.5)*.020;
  return {time,phase,charge,surge,impact,recoil,reveal:smooth(time/.9),cycle:Math.floor(time/PERIOD)};
 }
 function layout(w,h,box){
  const b=box||{x:0,y:50,width:w,height:h*.56};
  return {cx:b.x+b.width*.5,cy:b.y+b.height*.49,radius:Math.max(1,Math.min(b.width*.36,b.height*.39)),box:b};
 }
 function anchor(angle,s){
  const distance=.88+s.surge*.13-s.charge*.025+s.recoil;
  return {x:Math.cos(angle)*distance,y:Math.sin(angle)*distance*1.10};
 }
 // Six restraints with different depths. Interlocked texture coordinates move
 // with each whole strand: link material never scrolls independently of iron.
 const CHAINS=Object.freeze([
  {angle:-2.52,end:-2.66,depth:.72,thickness:.14},{angle:-.61,end:-.48,depth:.80,thickness:.15},
  {angle:2.39,end:2.63,depth:1,thickness:.19},{angle:.72,end:.49,depth:1.1,thickness:.19},
  {angle:3.02,end:3.16,depth:.57,thickness:.13},{angle:-.04,end:-.01,depth:.64,thickness:.13}
 ].map(Object.freeze));
 function chainPoint(index,u,s,outerDistance=2.8){
  const chain=CHAINS[index],a=anchor(chain.angle,s),end={x:Math.cos(chain.end)*outerDistance,y:Math.sin(chain.end)*outerDistance};
  const slack=(.14+.035*Math.sin(s.time*.76+index))*(1-s.surge*.93);
  const travel=s.phase-3.1-u*.30,shake=travel>0?smooth(travel/.045)*Math.sin(travel*38+index*.9)*Math.exp(-travel*5)*.035:0;
  const bend=Math.sin(u*Math.PI)*(slack+shake);
  return {x:a.x+(end.x-a.x)*u-Math.sin(chain.end)*bend,
   y:a.y+(end.y-a.y)*u+Math.cos(chain.end)*bend+Math.sin(u*Math.PI)*.055};
 }
 root.DarkSealMotion=Object.freeze({sample,layout,anchor,chainPoint,CHAINS,PERIOD,seed,TAU,smooth});
})(globalThis);
