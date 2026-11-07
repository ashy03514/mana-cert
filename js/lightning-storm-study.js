(() => {
  'use strict';

  const canvas = document.getElementById('storm');
  const ctx = canvas.getContext('2d');
  const mana = document.getElementById('mana');
  const phaseName = document.getElementById('phaseName');
  const pause = document.getElementById('pause');
  const speeds = document.querySelectorAll('[data-speed]');
  const stills = document.querySelectorAll('[data-time]');
  const renderer=new LightningStormRenderer();
  const cycleSeconds=1.2;
  let width=0,height=0,pixelRatio=1;
  let elapsed=0,rate=1,playing=true,previous=null;
  function resize(){
    const rect=canvas.getBoundingClientRect();
    width=Math.max(1,rect.width);height=Math.max(1,rect.height);
    pixelRatio=Math.min(window.devicePixelRatio||1,2);
    canvas.width=Math.round(width*pixelRatio);canvas.height=Math.round(height*pixelRatio);draw();
  }
  function draw(){
    ctx.setTransform(pixelRatio,0,0,pixelRatio,0,0);
    renderer.draw(ctx,canvas,width,height,{time:elapsed,box:{x:0,y:0,width,height}});
    const p=LightningStormRenderer.stateAt(elapsed,renderer.seed);
    if(mana.textContent!==String(p.value))mana.textContent=String(p.value);
    if(phaseName.textContent!==p.name)phaseName.textContent=p.name;
  }
  function frame(now) {
    if (playing && !document.hidden && previous !== null) elapsed += Math.min(0.1, (now - previous) / 1000) * rate;
    previous = now;
    if (playing && !document.hidden) draw();
    requestAnimationFrame(frame);
  }
  function setPlayback(on, still = null) {
    playing = on;
    previous = null;
    pause.textContent = on ? '暫停' : '繼續播放';
    pause.setAttribute('aria-pressed', String(!on));
    for (const button of stills) button.setAttribute('aria-pressed', String(button === still));
  }

  pause.addEventListener('click', () => setPlayback(!playing));
  document.getElementById('replay').addEventListener('click', () => {
    elapsed = 0;
    setPlayback(true);
    draw();
  });
  for (const button of speeds) button.addEventListener('click', () => {
    rate = Number(button.dataset.speed);
    for (const option of speeds) option.setAttribute('aria-pressed', String(option === button));
  });
  for (const button of stills) button.addEventListener('click', () => {
    elapsed = Math.floor(elapsed / cycleSeconds) * cycleSeconds + Number(button.dataset.time);
    setPlayback(false, button);
    draw();
  });
  document.addEventListener('visibilitychange', () => { previous = null; });
  new ResizeObserver(resize).observe(canvas);
  resize();
  requestAnimationFrame(frame);
})();
