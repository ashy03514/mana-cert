/* The preview owns the only clock. Inactive pages stop requesting frames;
 * resuming always establishes a fresh timestamp without advancing hidden time. */
(()=>{
 'use strict';
 const canvas=document.querySelector('#demonWings'),ctx=canvas.getContext('2d'),stage=document.querySelector('#stage');
 const pauseButton=document.querySelector('#pause'),replayButton=document.querySelector('#replay'),chainsToggle=document.querySelector('#chainsToggle');
 const speedButtons=[...document.querySelectorAll('[data-speed]')],phaseButtons=[...document.querySelectorAll('[data-time]')];
 const status=document.querySelector('#status'),error=document.querySelector('#error');
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 let renderer=null,time=reduced?5.8:0,speed=1,paused=reduced,hidden=document.hidden,pageHidden=false,last=null,raf=0;
 let disposed=false,failed=false,waiting=false,loading=true,width=1,height=1,dpr=1,lastStatus='';
 const active=()=>!paused&&!hidden&&!pageHidden&&!failed&&!waiting&&!loading&&!disposed;
 function statusText(){
  if(disposed)return '預覽已結束';
  if(failed)return '特效暫時無法顯示';
  if(waiting)return '繪圖暫時中斷 · 等待恢復';
  if(loading)return '正在載入羽翼素材。';
  if(paused)return '已暫停 · 可觀察翼膜與鎖鏈層次';
  return '凝聚 → 展翼爆發 → 緩慢待機';
 }
 function updateState(){
  document.body.dataset.still=String(!active());
  pauseButton.textContent=paused?'繼續播放':'暫停';pauseButton.setAttribute('aria-pressed',String(paused));
  for(const button of [pauseButton,replayButton,chainsToggle,...speedButtons,...phaseButtons])button.disabled=loading||failed||disposed;
  speedButtons.forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.speed)===speed)));
  phaseButtons.forEach(button=>button.setAttribute('aria-pressed',String(paused&&Number(button.dataset.time)===time)));
  const text=statusText();if(text!==lastStatus){status.textContent=text;lastStatus=text;}
 }
 function schedule(){
  if(active()){if(!raf)raf=requestAnimationFrame(tick);}
  else {if(raf)cancelAnimationFrame(raf);raf=0;last=null;}
 }
 function sync(){updateState();schedule();}
 function fail(problem){
  if(disposed||failed)return;
  failed=true;error.hidden=false;error.textContent='目前無法顯示羽翼動畫，請重新整理後再試。';
  canvas.dataset.error=String(problem?.message||problem||'render failed');sync();
 }
 function contextLost(event){
  event?.preventDefault();if(disposed||failed)return;
  waiting=true;error.hidden=false;error.textContent='繪圖暫時中斷，正在等待恢復。';sync();
 }
 function contextRestored(){
  if(disposed||failed)return;if(renderer.error){fail(renderer.error);return;}
  waiting=false;last=null;error.hidden=true;draw();sync();
 }
 function draw(){
  if(disposed||failed||loading||!renderer||!ctx)return false;
  if(renderer.lost){contextLost();return false;}
  try{
   ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);
   const rect=stage.getBoundingClientRect();
   const rendered=renderer.draw(ctx,width,height,{time,chains:chainsToggle.checked,box:{x:rect.left,y:rect.top,width:Math.max(1,rect.width),height:Math.max(1,rect.height)}});
   if(renderer.lost){contextLost();return false;}
   if(rendered===false||renderer.error){fail(renderer.error||'render unavailable');return false;}
   return true;
  }catch(problem){fail(problem);return false;}
 }
 function tick(now){
  raf=0;if(!active()){last=null;return;}
  if(last!==null)time+=Math.min(.05,Math.max(0,(now-last)/1000))*speed;
  last=now;draw();schedule();
 }
 function setPaused(value=true){
  if(disposed)return paused;paused=Boolean(value);last=null;sync();return paused;
 }
 function replay(){if(disposed||failed)return;time=0;paused=false;last=null;draw();sync();}
 function renderAt(value){
  if(disposed)return false;const requested=Number(value);time=Number.isFinite(requested)?Math.max(0,requested):0;
  paused=true;last=null;sync();return draw();
 }
 function resize(){
  if(disposed)return;width=Math.max(1,innerWidth);height=Math.max(1,innerHeight);dpr=Math.min(devicePixelRatio||1,1.5);
  canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);canvas.style.width=width+'px';canvas.style.height=height+'px';draw();
 }
 function visibility(){hidden=document.hidden;last=null;sync();}
 function pagehide(){pageHidden=true;last=null;sync();}
 function pageshow(){pageHidden=false;hidden=document.hidden;last=null;resize();sync();}
 function togglePause(){setPaused(!paused);}
 function changeSpeed(event){speed=Number(event.currentTarget.dataset.speed);last=null;sync();}
 function choosePhase(event){renderAt(event.currentTarget.dataset.time);}
 function changeChains(){draw();}
 function dispose(){
  if(disposed)return;disposed=true;last=null;if(raf)cancelAnimationFrame(raf);raf=0;
  removeEventListener('resize',resize);removeEventListener('scroll',draw);removeEventListener('pagehide',pagehide);removeEventListener('pageshow',pageshow);document.removeEventListener('visibilitychange',visibility);
  pauseButton.removeEventListener('click',togglePause);replayButton.removeEventListener('click',replay);chainsToggle.removeEventListener('change',changeChains);
  speedButtons.forEach(button=>button.removeEventListener('click',changeSpeed));phaseButtons.forEach(button=>button.removeEventListener('click',choosePhase));
  if(renderer){renderer.canvas.removeEventListener('webglcontextlost',contextLost);renderer.canvas.removeEventListener('webglcontextrestored',contextRestored);renderer.dispose();}updateState();
 }
 const getState=()=>({paused,loading,waiting,failed,disposed,hidden,pageHidden,chains:chainsToggle.checked,rafPending:!!raf,reducedMotion:reduced});
 window.darkDemonWingMotionStudy={get renderer(){return renderer;},get time(){return time;},get speed(){return speed;},get state(){return getState();},getState,renderAt,pause:setPaused,resize,dispose};
 pauseButton.addEventListener('click',togglePause);replayButton.addEventListener('click',replay);chainsToggle.addEventListener('change',changeChains);
 speedButtons.forEach(button=>button.addEventListener('click',changeSpeed));phaseButtons.forEach(button=>button.addEventListener('click',choosePhase));
 addEventListener('resize',resize);addEventListener('scroll',draw,{passive:true});addEventListener('pagehide',pagehide);addEventListener('pageshow',pageshow);document.addEventListener('visibilitychange',visibility);
 try{
  if(!ctx)throw Error('Canvas 2D unavailable');renderer=new DarkDemonWingMotionRenderer();
  renderer.canvas.addEventListener('webglcontextlost',contextLost);renderer.canvas.addEventListener('webglcontextrestored',contextRestored);
  resize();sync();Promise.resolve(renderer.ready).then(ready=>{
   if(disposed)return;if(!ready||renderer.error){fail(renderer.error||'asset loading');return;}
   loading=false;last=null;draw();sync();
  }).catch(fail);
 }catch(problem){fail(problem);}
})();
