/* Standalone SS art review. This host owns only active playback time and UI. */
(()=>{
  'use strict';
  const canvas=document.querySelector('#holy'),stage=document.querySelector('#stage');
  const ctx=canvas.getContext('2d');
  const pauseButton=document.querySelector('#pause'),replayButton=document.querySelector('#replay');
  const speedButtons=[...document.querySelectorAll('[data-speed]')],phaseButtons=[...document.querySelectorAll('[data-time]')];
  const status=document.querySelector('#status'),error=document.querySelector('#error');
  let renderer=null,time=0,speed=1,paused=false,hidden=document.hidden,pageHidden=false,last=null;
  let raf=0,disposed=false,failed=false,waiting=false,width=1,height=1,dpr=1;

  function state(){
    document.body.dataset.still=String(paused||hidden||pageHidden||waiting||disposed);
    pauseButton.textContent=paused?'繼續播放':'暫停';pauseButton.setAttribute('aria-pressed',String(paused));
    phaseButtons.forEach(button=>button.setAttribute('aria-pressed',String(paused&&Number(button.dataset.time)===time)));
    if(!failed)status.textContent=disposed?'預覽已結束':waiting?'繪圖暫時中斷 · 等待恢復':paused?'已暫停 · 可觀察光翼與光冠層次':'SS 美術預覽 · 不產生鑑定結果';
  }
  function fail(problem){
    if(failed||disposed)return;
    failed=true;last=null;error.hidden=false;error.textContent='目前無法顯示六翼聖光，請重新整理後再試。';
    status.textContent='特效暫時無法顯示';canvas.dataset.error=String(problem&&problem.message||problem||'render failed');
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
    if(disposed||failed||!renderer||!ctx)return false;
    if(renderer.lost){contextLost();return false;}
    try{
      ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);
      const rect=stage.getBoundingClientRect();
      const rendered=renderer.draw(ctx,width,height,{time,opacity:1,
        box:{x:rect.left,y:rect.top,width:Math.max(1,rect.width),height:Math.max(1,rect.height)}});
      if(renderer.lost){contextLost();return false;}
      if(rendered===false||renderer.error){fail(renderer.error||'render unavailable');return false;}
      return true;
    }catch(problem){fail(problem);return false;}
  }
  function setPaused(value=true){
    if(disposed)return paused;
    paused=Boolean(value);last=null;state();return paused;
  }
  function resize(){
    if(disposed)return;
    width=Math.max(1,window.innerWidth);height=Math.max(1,window.innerHeight);
    dpr=Math.min(1.5,window.devicePixelRatio||1);
    canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
    canvas.style.width=width+'px';canvas.style.height=height+'px';draw();
  }
  function tick(now){
    if(disposed)return;
    const active=!paused&&!hidden&&!pageHidden&&!failed&&!waiting;
    if(active){if(last!==null)time+=Math.min(.05,Math.max(0,(now-last)/1000))*speed;draw();}
    last=active&&!waiting?now:null;raf=requestAnimationFrame(tick);
  }
  function replay(){if(disposed)return;time=0;setPaused(false);draw();}
  function renderAt(value){
    if(disposed)return false;
    const requested=Number(value);time=Number.isFinite(requested)?Math.max(0,requested):0;
    setPaused(true);return draw();
  }
  function visibility(){hidden=document.hidden;last=null;state();}
  function pagehide(){pageHidden=true;last=null;state();}
  function pageshow(){pageHidden=false;hidden=document.hidden;last=null;state();resize();}
  function togglePause(){setPaused(!paused);}
  function changeSpeed(event){
    speed=Number(event.currentTarget.dataset.speed);last=null;
    speedButtons.forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.speed)===speed)));
  }
  function choosePhase(event){renderAt(event.currentTarget.dataset.time);}
  function dispose(){
    if(disposed)return;
    disposed=true;last=null;cancelAnimationFrame(raf);
    window.removeEventListener('resize',resize);window.removeEventListener('scroll',draw);
    window.removeEventListener('pagehide',pagehide);window.removeEventListener('pageshow',pageshow);
    document.removeEventListener('visibilitychange',visibility);
    pauseButton.removeEventListener('click',togglePause);replayButton.removeEventListener('click',replay);
    speedButtons.forEach(button=>button.removeEventListener('click',changeSpeed));
    phaseButtons.forEach(button=>button.removeEventListener('click',choosePhase));
    if(renderer){renderer.canvas.removeEventListener('webglcontextlost',contextLost);renderer.canvas.removeEventListener('webglcontextrestored',contextRestored);renderer.dispose();}
    state();
  }
  window.lightHolyStudy={get renderer(){return renderer;},get time(){return time;},get speed(){return speed;},renderAt,pause:setPaused,resize,dispose};
  pauseButton.addEventListener('click',togglePause);replayButton.addEventListener('click',replay);
  speedButtons.forEach(button=>button.addEventListener('click',changeSpeed));
  phaseButtons.forEach(button=>button.addEventListener('click',choosePhase));
  window.addEventListener('resize',resize);window.addEventListener('scroll',draw,{passive:true});
  window.addEventListener('pagehide',pagehide);window.addEventListener('pageshow',pageshow);
  document.addEventListener('visibilitychange',visibility);
  try{
    if(!ctx)throw new Error('Canvas 2D unavailable');
    renderer=new LightHolyRenderer();
    renderer.canvas.addEventListener('webglcontextlost',contextLost);renderer.canvas.addEventListener('webglcontextrestored',contextRestored);
    if(renderer.error)throw new Error(renderer.error);
    resize();state();raf=requestAnimationFrame(tick);
  }catch(problem){fail(problem);}
})();
