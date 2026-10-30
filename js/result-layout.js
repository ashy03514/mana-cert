/* Result-stage composition: reserve text/actions first, then fit the complete
 * attribute silhouette above it. Uniform fitting retains rank proportions. */
(function(root){
 'use strict';
 function bounds(box,element){
  const b=box,w=b.width,h=b.height,cx=b.x+w/2;
  let bottom,width=w;
  if(element==='water'){bottom=b.y+h/2+w*.47;width=w*1.32;}
  else if(element==='fire'){bottom=b.y+h/2+w*.48;width=w*1.55;}
  else if(element==='wind'){bottom=b.y+h/2+1.05*h/2.68+h*.12;width=w*1.15;}
  else if(element==='earth'){bottom=b.y+h*1.08;width=w*1.16;}
  else if(element==='dark'){
   const artWidth=Math.min(w*.88,h*1.35),artHeight=artWidth*2/3;
   bottom=b.y+(h+artHeight)/2+artWidth*.08;width=w*1.08;
  }else{bottom=b.y+h*1.04;width=w*1.08;}
  return {left:cx-width/2,right:cx+width/2,bottom,width};
 }
 function compose(width,height,base,{element,buttonTop=height-84,preview=false,referenceBox=base.box}={}){
  const wide=width>=height*1.35,font=base.numbers.fontSize,rankSize=font*1.65;
  const bottom=preview?height-174:buttonTop-24,pad=rankSize*.32+6;
  const titleHeight=21,gap=12,blockHeight=titleHeight+gap+font+gap+rankSize+pad*2;
  const titleTop=bottom-blockHeight,valueTop=titleTop+titleHeight+gap;
  const rankTop=valueTop+font+gap+pad,x=wide?width*.76:width/2;
  const effectBottom=wide?height-30:titleTop-26;
  const ref=bounds(referenceBox,element),fitWidth=wide?width*.49:width*1.08;
  // Lower the composition by about ten percent of the viewport. Fit the
  // subject into the remaining stage height rather than push it into text.
  const offsetY=Math.min(height*.10,effectBottom*.22);
  const scale=Math.min(1,(effectBottom-offsetY)/Math.max(1,ref.bottom),wide?fitWidth/ref.width:1);
  const sourceX=referenceBox.x+referenceBox.width/2,targetX=wide?width*.27:width/2;
  const box={...base.box,x:targetX+(base.box.x-sourceX)*scale,y:base.box.y*scale+offsetY,
   width:base.box.width*scale,height:base.box.height*scale};
  if(Number.isFinite(box.gatherY))box.gatherY=box.gatherY*scale+offsetY;
  const envelope=bounds(box,element);
  return {...base,box,sideBySide:wide,
   numbers:{...base.numbers,x},
   composition:{titleTop,titleY:titleTop+titleHeight,valueY:valueTop+font*.82,
    rankY:rankTop+rankSize*.82,rankSize,effectBottom,bottom,envelope,scale,offsetY},
   readout:{x:x-(wide?width*.20:width*.43),y:titleTop-8,width:wide?width*.40:width*.86,height:bottom-titleTop+16}};
 }
 root.ResultLayout=Object.freeze({compose,bounds});
})(globalThis);
