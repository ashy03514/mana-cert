/* Dark uses the approved rare-wing formation/exposure schedule. The selected
 * result and displayed mana stay authoritative; only its visual presentation
 * is adapted to the membrane wing's fixed root and dark color language. */
(function(root){
 'use strict';
 const source=()=>root.LightRankGrowth;
 function scan(elapsed,result){
  const sampled=source().scan(elapsed,result);
  return {...sampled,label:sampled.label==='聖光凝聚'?'闇能凝聚':sampled.label};
 }
 function sample(elapsed,result,formationDuration=.8){return source().sample(elapsed,result,formationDuration);}
 function initial(materialTime=0,formationDuration=.8){
  const pose=source().initial(materialTime);
  const duration=Number.isFinite(formationDuration)&&formationDuration>0?formationDuration:.8;
  const t=Math.max(0,Math.min(1,(Number.isFinite(materialTime)?materialTime:0)/duration));
  // Birth uses the same registered root-out veil as later evolutions, but
  // has no previous wing underneath it. The fire remains owned by the host.
  return {...pose,transition:{from:'A',to:'A',progress:t*t*(3-2*t),birth:true}};
 }
 function timeline(result){return source().timeline(result);}
 function evolutionAction(elapsed,result){return source().evolutionAction(elapsed,result);}
 function layout(width,height,shift=0,options={}){
  const result=source().layout(width,height,shift,options);
  const rest=source().layout(width,height,0,options).box;
  const artWidth=Math.min(rest.width*.88,rest.height*1.35),artHeight=artWidth*2/3;
  // The gather target stays at the pre-readout root. It does not chase the
  // subsequent upward framing shift or assume the angel asset's .72 pivot.
  return {...result,box:{...result.box,gatherY:rest.y+(rest.height-artHeight)*.5+artHeight*.43}};
 }
 root.DarkRankGrowth=Object.freeze({scan,sample,initial,layout,timeline,evolutionAction,get timing(){return source().timing;}});
})(globalThis);
