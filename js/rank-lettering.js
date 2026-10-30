/* Display regions of the approved artwork without altering its pixels.
 * Plain rank text remains available to assistive technology and on load error. */
(function(root){
 'use strict';
 const source=new URL('../assets/rank-lettering-concept-v1.png',document.currentScript.src).href;
 // x, y, width, height, visible letter cap height in the source sheet.
 const regions=Object.freeze({
  E:[20,75,340,390,350],D:[395,80,365,390,350],C:[785,75,365,400,365],B:[1170,75,365,395,350],
  A:[8,540,445,410,380],S:[458,530,345,415,380],SS:[810,500,725,475,400]
 });
 const image=new Image();
 const ready=new Promise(resolve=>{
  image.onload=()=>{document.documentElement.classList.add('rankArtReady');resolve(true);};
  image.onerror=()=>resolve(false);image.src=source;
 });
 function apply(host,rank){
  if(host.dataset.rankArt===rank)return;
  host.dataset.rankArt=rank;
  const text=document.createElement('span');text.className='rankText';text.textContent=rank;
  const region=regions[rank];host.classList.toggle('rankHasArt',!!region);
  if(!region){host.replaceChildren(text);return;}
  const [x,y,width,height,cap]=region,unit=cap/.88;
  const art=document.createElement('span');art.className='rankArtwork';art.setAttribute('aria-hidden','true');
  Object.assign(art.style,{width:width/unit+'em',height:height/unit+'em',
   backgroundImage:`url("${source}")`,backgroundSize:`${1536/unit}em ${1024/unit}em`,backgroundPosition:`${-x/unit}em ${-y/unit}em`});
  host.replaceChildren(text,art);
 }
 root.RankLettering=Object.freeze({apply,ready,source,regions});
})(globalThis);
