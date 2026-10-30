/* Standalone SS art review. The host owns one active clock for every layer. */
(()=>{
  'use strict';
  const canvas=document.querySelector('#darkSeal'),stage=document.querySelector('#stage'),ctx=canvas.getContext('2d');
  const pauseButton=document.querySelector('#pause'),replayButton=document.querySelector('#replay');
  const speeds=[...document.querySelectorAll('[data-speed]')],phases=[...document.querySelectorAll('[data-time]')];
  const status=document.querySelector('#status'),error=document.querySelector('#error');
  let renderer=null,time=0,speed=1,paused=false,loading=true,failed=false,waiting=false,disposed=false;
  let hidden=document.hidden,pageHidden=false,last=null,raf=0,width=1,height=1,dpr=1;
  function getState(){return {time,speed,paused,loading,ready:!loading&&!failed&&!disposed,failed,waiting,disposed,hidden,pageHidden};}
  function state(){
    document.body.dataset.still=String(paused||loading||failed||waiting||hidden||pageHidden||disposed);
    pauseButton.textContent=paused?'繼續播放':'暫停';pauseButton.setAttribute('aria-pressed',String(paused));
    for(const button of [pauseButton,replayButton,...speeds,...phases])button.disabled=loading||failed||disposed;
    phases.forEach(button=>button.setAttribute('aria-pressed',String(paused&&Math.abs(Number(button.dataset.time)-time)<1e-8)));
    if(!failed)status.textContent=disposed?'預覽已結束':loading?'正在載入鎖鏈素材。':waiting?'繪圖暫時中斷 · 等待恢復':paused?'已暫停 · 可觀察鎖鏈與封印細節':'SS 美術預覽 · 不產生鑑定結果';
  }
  function fail(problem){
    if(disposed||failed)return;
    failed=true;loading=false;last=null;error.hidden=false;
    error.textContent='目前無法顯示深淵封印，請重新整理後再試。';status.textContent='特效暫時無法顯示';
    canvas.dataset.error=String(problem?.message||problem||'render failed');state();
  }
  function contextLost(event){
    event?.preventDefault();if(disposed||failed)return;
    waiting=true;last=null;error.hidden=false;error.textContent='繪圖暫時中斷，正在等待恢復。';state();
  }
  function contextRestored(){
    if(disposed||failed)return;
    if(renderer.error){fail(renderer.error);return;}
    waiting=false;last=null;error.hidden=true;state();draw();
  }
  function draw(){
    if(disposed||failed||loading||!renderer||!ctx)return false;
    if(renderer.lost){contextLost();return false;}
    try{
      ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);
      const rect=stage.getBoundingClientRect();
      const ok=renderer.draw(ctx,width,height,{time,box:{x:rect.left,y:rect.top,width:Math.max(1,rect.width),height:Math.max(1,rect.height)}});
      if(renderer.lost){contextLost();return false;}
      if(ok===false||renderer.error){fail(renderer.error||'render unavailable');return false;}
      return true;
    }catch(problem){fail(problem);return false;}
  }
  function setPaused(value=true){if(disposed)return paused;paused=Boolean(value);last=null;state();return paused;}
  function resize(){
    if(disposed)return;
    width=Math.max(1,innerWidth);height=Math.max(1,innerHeight);dpr=Math.min(devicePixelRatio||1,1.5);
    canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
    canvas.style.width=width+'px';canvas.style.height=height+'px';draw();
  }
  function tick(now){
    if(disposed)return;
    const active=!paused&&!loading&&!failed&&!waiting&&!hidden&&!pageHidden;
    if(active){if(last!==null)time+=Math.min(.05,Math.max(0,(now-last)/1000))*speed;draw();}
    last=active&&!waiting?now:null;raf=requestAnimationFrame(tick);
  }
  function renderAt(value){
    if(disposed)return false;
    const requested=Number(value);time=Number.isFinite(requested)?Math.max(0,requested):0;
    setPaused(true);return draw();
  }
  function replay(){if(disposed)return;time=0;setPaused(false);draw();}
  function togglePause(){setPaused(!paused);}
  function changeSpeed(event){
    speed=Number(event.currentTarget.dataset.speed);last=null;
    speeds.forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.speed)===speed)));
  }
  function choosePhase(event){renderAt(event.currentTarget.dataset.time);}
  function visibility(){hidden=document.hidden;last=null;state();}
  function pagehide(){pageHidden=true;last=null;state();}
  function pageshow(){pageHidden=false;hidden=document.hidden;last=null;state();resize();}
  function dispose(){
    if(disposed)return;disposed=true;last=null;cancelAnimationFrame(raf);
    removeEventListener('resize',resize);removeEventListener('scroll',draw);removeEventListener('pagehide',pagehide);removeEventListener('pageshow',pageshow);
    document.removeEventListener('visibilitychange',visibility);
    pauseButton.removeEventListener('click',togglePause);replayButton.removeEventListener('click',replay);
    speeds.forEach(button=>button.removeEventListener('click',changeSpeed));phases.forEach(button=>button.removeEventListener('click',choosePhase));
    renderer?.canvas?.removeEventListener('webglcontextlost',contextLost);renderer?.canvas?.removeEventListener('webglcontextrestored',contextRestored);
    renderer?.dispose();state();
  }
  window.darkSealStudy={get renderer(){return renderer;},get time(){return time;},get state(){return getState();},renderAt,resize,dispose,getState,pause:setPaused,replay};
  pauseButton.addEventListener('click',togglePause);replayButton.addEventListener('click',replay);
  speeds.forEach(button=>button.addEventListener('click',changeSpeed));phases.forEach(button=>button.addEventListener('click',choosePhase));
  addEventListener('resize',resize);addEventListener('scroll',draw,{passive:true});addEventListener('pagehide',pagehide);addEventListener('pageshow',pageshow);
  document.addEventListener('visibilitychange',visibility);
  try{
    if(!ctx)throw new Error('Canvas 2D unavailable');
    renderer=new DarkSealRenderer();
    renderer.canvas?.addEventListener('webglcontextlost',contextLost);renderer.canvas?.addEventListener('webglcontextrestored',contextRestored);
    resize();state();raf=requestAnimationFrame(tick);
    Promise.resolve(renderer.ready).then(ready=>{
      if(disposed)return;if(!ready||renderer.error){fail(renderer.error||'鎖鏈素材載入失敗');return;}
      loading=false;last=null;state();draw();
    }).catch(fail);
  }catch(problem){fail(problem);}
})();
