/* Result composition keeps the authored attribute scale. Text and subjects
 * are positioned around the visible silhouette, not transparent canvas padding. */
(function(root){
 'use strict';
 function bounds(box,element){
  const b=box,w=b.width,h=b.height,cx=b.x+w/2;
  let bottom,width=w;
  if(element==='water'){bottom=b.y+h/2+w*.40;width=w*1.32;}
  else if(element==='fire'){bottom=b.y+h/2+w*.44;width=w*1.55;}
  else if(element==='wind'){
   // The funnel meets world y=-.85. Its ground eddies occupy only a thin
   // layer, rather than the former 12% of the entire tall cloud canvas.
   bottom=b.y+h/2+1.05*h/2.68+h*.035;width=w*1.15;
  }else if(element==='earth'){bottom=b.y+h*.97;width=w*1.16;}
  else if(element==='dark'){
   const artWidth=Math.min(w*.88,h*1.35),artHeight=artWidth*2/3;
   bottom=b.y+(h+artHeight)/2+artWidth*.06;width=w*1.08;
  }else{
   const artHeight=Math.min(h*.87,w/1.5*.87),artWidth=artHeight*1.5;
   const rootY=b.y+(h-artHeight)/2+artHeight*.72,unit=Math.max(1,Math.min(w*.385,h*.38,320));
   // Include the SS halo (radius 1.12, center .23 above the root), so its
   // lower arc does not run behind the attribute name.
   bottom=Math.max(b.y+(h+artHeight)/2+artWidth*.07,rootY+unit*.93);width=w*1.08;
  }
  return {left:cx-width/2,right:cx+width/2,bottom,width};
 }
 function compose(width,height,base,{element,buttonTop=height-84,preview=false,referenceBox=base.box}={}){
  const wide=width>=height*1.35,font=base.numbers.fontSize,rankSize=font*1.55;
  const bottom=preview?height-174:buttonTop-18,pad=rankSize*.26+6;
  const titleHeight=21,gap=10,blockHeight=titleHeight+gap+font+gap+rankSize+pad*2;
  // On the reference phone, keep the name close to the full-sized subject.
  // The rank's complete sparkle envelope still clears the bottom action.
  const titleTop=Math.min(height*.60,bottom-blockHeight),valueTop=titleTop+titleHeight+gap;
  const rankTop=valueTop+font+gap+pad,x=wide?width*.76:width/2;
  const effectBottom=wide?height-30:titleTop-14;
  const ref=bounds(referenceBox,element),scale=1;
  const sourceX=referenceBox.x+referenceBox.width/2,targetX=wide?width*.27:width/2;
  // Translation only: never change the approved shader scale, wing span or
  // particle size to make room for labels. Keep one anchor through growth.
  const offsetY=effectBottom-ref.bottom;
  const box={...base.box,x:targetX+base.box.x-sourceX,y:base.box.y+offsetY,
   width:base.box.width,height:base.box.height};
  if(Number.isFinite(box.gatherY))box.gatherY+=offsetY;
  const envelope=bounds(box,element);
  return {...base,box,sideBySide:wide,
   numbers:{...base.numbers,x},
   composition:{titleTop,titleY:titleTop+titleHeight,valueY:valueTop+font*.82,
    rankY:rankTop+rankSize*.82,rankSize,effectBottom,bottom,envelope,scale,offsetY},
   readout:{x:x-(wide?width*.20:width*.43),y:titleTop-8,width:wide?width*.40:width*.86,height:bottom-titleTop+16}};
 }
 root.ResultLayout=Object.freeze({compose,bounds});
})(globalThis);
