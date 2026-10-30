/* Live white rank lettering and decorative stars. Uses the reveal clock;
 * no image downloads, timers, result mutation or extra animation loop. */
(function(root){
 'use strict';
 const ranks=['E','D','C','B','A','S','SS'];
 const profiles=Object.freeze(Object.fromEntries(ranks.map((rank,i)=>[rank,Object.freeze({
  count:[1,2,3,4,6,9,13][i],glow:.12+i*.125,spread:5+i*3.8,level:i
 })])));
 const unit=n=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
 const states=new WeakMap();
 const reduced=typeof matchMedia==='function'?matchMedia('(prefers-reduced-motion: reduce)'):null;
 function frames(rank,time=0){
  const p=profiles[rank];if(!p)return [];
  const t=Math.max(0,Number.isFinite(time)?time:0);
  return Array.from({length:p.count},(_,i)=>{
   const seed=17+i*31+p.level*137,period=1.5+unit(seed)*.9;
   const clock=t+unit(seed+1)*period,cycle=Math.floor(clock/period),age=clock-cycle*period;
   const life=period*(.57+unit(seed+2)*.15),u=Math.min(1,age/life);
   const random=n=>unit(seed+cycle*73+n*11);
   const angle=((i+random(1)*.7)/p.count)*Math.PI*2;
   const radius=.63+random(2)*.14;
   const envelope=Math.pow(Math.sin(Math.PI*u),1.35);
   return {x:50+Math.cos(angle)*radius*100,y:50+Math.sin(angle)*(.48+random(3)*.10)*100,
    size:.11+random(4)*(.07+p.level*.009),scale:envelope,opacity:envelope*(.65+random(5)*.35),
    rotation:random(6)*360+(random(7)<.5?-1:1)*(100+random(8)*140)*u,cycle};
  });
 }
 function apply(host,rank,time=0){
  let state=states.get(host);
  if(!state||state.rank!==rank){
   host.dataset.rank=rank;
   const text=document.createElement('span');text.className='rankText';text.textContent=rank;
   const layer=document.createElement('span');layer.className='rankSparkles';layer.setAttribute('aria-hidden','true');
   const p=profiles[rank],stars=[];
   if(p){
    host.style.setProperty('--rank-glow',String(p.glow));
    host.style.setProperty('--rank-glow-radius',p.spread*2+'px');
    for(let i=0;i<p.count;i++){
     const star=document.createElementNS('http://www.w3.org/2000/svg','svg');
     star.classList.add('rankSpark');star.setAttribute('viewBox','0 0 40 40');star.setAttribute('focusable','false');
     const path=document.createElementNS('http://www.w3.org/2000/svg','path');
     path.setAttribute('d','M20 0C22 15 25 18 40 20C25 22 22 25 20 40C18 25 15 22 0 20C15 18 18 15 20 0Z');
     star.append(path);layer.append(star);stars.push(star);
    }
   }else{host.style.setProperty('--rank-glow','0');}
   host.replaceChildren(text,layer);state={rank,stars};states.set(host,state);
  }
  if(reduced?.matches)return;
  frames(rank,time).forEach((frame,i)=>{
   const style=state.stars[i].style;
   style.left=frame.x+'%';style.top=frame.y+'%';style.width=style.height=frame.size+'em';
   style.opacity=String(frame.opacity);
   style.transform='translate(-50%,-50%) rotate('+frame.rotation+'deg) scale('+frame.scale+')';
  });
 }
 root.RankLettering=Object.freeze({apply,frames,profiles,ready:Promise.resolve(true)});
})(globalThis);
