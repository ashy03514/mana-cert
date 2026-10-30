const fs=require('node:fs');
const {chromium}=require('C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}});
  await page.addInitScript(()=>{requestAnimationFrame=()=>1;cancelAnimationFrame=()=>{};});
  await page.goto('file:///C:/Codex/mana-cert-main/wind-tornado-study.html');
  const results=await page.evaluate(()=>{
   const r=windTornadoStudy.renderer,images=[];
   for(const t of [2,3.2,2,3.2,2]){
    windTornadoStudy.renderAt(t);
    const p=r.patchCtx.getImageData(0,0,r.patch.width,r.patch.height).data;
    let hash=0;for(let i=0;i<p.length;i++)hash=(Math.imul(hash,31)+p[i])|0;
    images.push({pixels:[...p],hash,time:r.time,box:r.renderBox,count:r.drawCount,error:r.error,size:[r.patch.width,r.patch.height]});
   }
   return images.map((x,n)=>{
    const previous=images[n>1?n-2:0];let changed=0,max=0,total=0;
    x.pixels.forEach((p,i)=>{const d=Math.abs(p-previous.pixels[i]);if(d)changed++;max=Math.max(max,d);total+=d;});
    const {pixels,...rest}=x;return {...rest,changed,max,total};
   });
  });
  console.log(JSON.stringify(results,null,2));
  await page.screenshot({path:'artifacts/tornado-probe.png'});
 }finally{await browser.close();}
})();
