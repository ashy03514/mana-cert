(function(){
  'use strict';
  const status=document.getElementById('pwaStatus'),button=document.getElementById('checkUpdate');
  let registration=null;
  const waiting=()=>{status.textContent='新版已下載，請關閉此網站的分頁與 PWA 後再開啟。';};
  function watch(reg){
    if(reg.waiting)waiting();
    const worker=reg.installing;
    if(worker)worker.addEventListener('statechange',()=>{
      if(worker.state==='installed'&&navigator.serviceWorker.controller)waiting();
      else if(worker.state==='activated')status.textContent='離線資源已就緒';
      else if(worker.state==='redundant')status.textContent='更新未完成，目前版本仍可使用。';
    });
  }
  if(!('serviceWorker' in navigator)){
    status.textContent='此瀏覽器不支援離線快取，仍可連線鑑定。';button.disabled=true;return;
  }
  navigator.serviceWorker.register('./service-worker.js',{updateViaCache:'none'}).then(reg=>{
    registration=reg;watch(reg);reg.addEventListener('updatefound',()=>watch(reg));
    navigator.serviceWorker.ready.then(()=>{if(reg.waiting)waiting();else status.textContent='離線資源已就緒';});
  }).catch(()=>{status.textContent='離線快取尚未就緒，請連線後重試。';});
  button.addEventListener('click',async()=>{
    button.disabled=true;status.textContent='正在檢查更新…';
    try{
      if(!registration)registration=await navigator.serviceWorker.register('./service-worker.js',{updateViaCache:'none'});
      await registration.update();watch(registration);
      if(!registration.waiting&&!registration.installing)status.textContent='更新檢查完成，目前沒有待安裝版本。';
    }catch(_){status.textContent='暫時無法檢查更新，已下載版本仍可使用。';}
    finally{button.disabled=false;}
  });
})();
