/* Isolated A→S acceptance study; no changes to formal results or PWA assets. */
(()=>{
  'use strict';
  const canvas=document.querySelector('#angel'),stage=document.querySelector('#stage'),ctx=canvas.getContext('2d');
  const pause=document.querySelector('#pause'),replay=document.querySelector('#replay'),slider=document.querySelector('#progress'),value=document.querySelector('#progressValue');
  const speeds=[...document.querySelectorAll('[data-speed]')],phases=[...document.querySelectorAll('[data-progress]')];
  const status=document.querySelector('#status'),error=document.querySelector('#error');
  const renderer=new LightAngelLayeredGrowthRenderer(),HOLD=.8,FORM=2.4,SETTLE=.9,DURATION=FORM+SETTLE,END=HOLD+DURATION+.6;
  let time=0,speed=1,paused=false,last=null,ready=false,failed=false,waiting=false,hidden=document.hidden,pageHidden=false,disposed=false,raf=0;
  let width=1,height=1,dpr=1;
  const progress=()=>Math.max(0,Math.min(1,(time-HOLD)/DURATION));
  const appearance=()=>{
    const age=Math.max(0,time-HOLD),p=Math.max(0,Math.min(1,(age-FORM)/SETTLE));
    return {shape:Math.min(1,age/FORM),exposure:1-p*p*(3-2*p)};
  };
  function state(){
    const p=progress();slider.value=String(Math.round(p*1000));value.textContent=Math.round(p*100)+'%';
    pause.textContent=paused?'繼續播放':'暫停';pause.setAttribute('aria-pressed',String(paused));
    phases.forEach(b=>b.setAttribute('aria-pressed',String(paused&&Math.abs(Number(b.dataset.progress)-p)<.001)));
    const phase=appearance().shape<1?'羽化光流 · 新羽逐層展開':appearance().exposure>0?'形體完成 · 高光漸退':'原色羽翼 · 成長完成';
    status.textContent=failed?'特效暫時無法顯示':waiting?'繪圖暫時中斷 · 等待恢復':!ready?'正在載入羽翼素材。':time>=END?'成長完成 · 可重播或拖動進度':(paused?'已暫停 · ':'')+phase;
  }
  function fail(message){failed=true;last=null;error.hidden=false;error.textContent='目前無法顯示羽翼成長，請重新整理。';canvas.dataset.error=String(message);state();}
  function draw(){
    if(disposed||!ready||failed||waiting)return false;
    try{
      ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);
      const rect=stage.getBoundingClientRect(),{shape,exposure}=appearance();
      const ok=renderer.draw(ctx,width,height,{time:3+time,motionTime:4+time*.7,growth:shape,growthExposure:exposure,rank:shape===1?'S':'A',starMana:950*shape,
        box:{x:rect.left,y:rect.top,width:rect.width,height:rect.height}});
      if(!ok||renderer.error){fail(renderer.diagnostic||renderer.error||'render unavailable');return false;}
      return true;
    }catch(e){fail(e);return false;}
  }
  function resize(){if(disposed)return;width=innerWidth;height=innerHeight;dpr=Math.min(devicePixelRatio||1,1.5);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);renderer.lastTime=-Infinity;draw();}
  function setProgress(p){time=HOLD+Math.max(0,Math.min(1,Number(p)||0))*DURATION;paused=true;last=null;renderer.lastTime=-Infinity;state();draw();}
  function toggle(){if(time>=END&&!paused)return;if(time>=END)time=0;paused=!paused;last=null;state();draw();}
  function restart(){time=0;paused=false;last=null;renderer.lastTime=-Infinity;state();draw();}
  function tick(now){
    if(disposed)return;
    const active=ready&&!paused&&!failed&&!waiting&&!hidden&&!pageHidden;
    if(active){if(last!==null)time=Math.min(END,time+Math.min(.05,Math.max(0,(now-last)/1000))*speed);draw();if(time>=END)paused=true;state();}
    last=active&&!paused?now:null;raf=requestAnimationFrame(tick);
  }
  function lost(e){e.preventDefault();waiting=true;last=null;state();}
  function restored(){if(renderer.error){fail(renderer.error);return;}waiting=false;last=null;renderer.lastTime=-Infinity;draw();state();}
  function visibility(){hidden=document.hidden;last=null;state();}
  function hide(){pageHidden=true;last=null;}
  function show(){pageHidden=false;hidden=document.hidden;last=null;resize();}
  const onSlider=()=>setProgress(Number(slider.value)/1000);
  const onSpeed=e=>{speed=Number(e.currentTarget.dataset.speed);last=null;speeds.forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.speed)===speed)));};
  const onPhase=e=>setProgress(e.currentTarget.dataset.progress);
  pause.addEventListener('click',toggle);replay.addEventListener('click',restart);slider.addEventListener('input',onSlider);
  speeds.forEach(b=>b.addEventListener('click',onSpeed));phases.forEach(b=>b.addEventListener('click',onPhase));
  renderer.canvas.addEventListener('webglcontextlost',lost);renderer.canvas.addEventListener('webglcontextrestored',restored);
  addEventListener('resize',resize);addEventListener('scroll',draw,{passive:true});addEventListener('pagehide',hide);addEventListener('pageshow',show);document.addEventListener('visibilitychange',visibility);
  function dispose(){
    if(disposed)return;disposed=true;cancelAnimationFrame(raf);
    removeEventListener('resize',resize);removeEventListener('scroll',draw);removeEventListener('pagehide',hide);removeEventListener('pageshow',show);document.removeEventListener('visibilitychange',visibility);
    pause.removeEventListener('click',toggle);replay.removeEventListener('click',restart);slider.removeEventListener('input',onSlider);
    speeds.forEach(b=>b.removeEventListener('click',onSpeed));phases.forEach(b=>b.removeEventListener('click',onPhase));
    renderer.canvas.removeEventListener('webglcontextlost',lost);renderer.canvas.removeEventListener('webglcontextrestored',restored);renderer.dispose();
  }
  window.wingGrowthStudy={renderer,setProgress,render:draw,dispose,getState:()=>({progress:progress(),...appearance(),paused,time,speed,ready,waiting,failed,disposed})};
  resize();state();raf=requestAnimationFrame(tick);
  renderer.ready.then(ok=>{if(disposed)return;if(!ok){fail(renderer.error);return;}ready=true;last=null;state();draw();}).catch(fail);
})();
