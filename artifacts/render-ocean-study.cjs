const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {createCanvas,loadImage}=require('C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
 try{
 const page=await browser.newPage({viewport:{width:560,height:560}});page.on('pageerror',e=>console.error(e));
 await page.goto((process.env.MANA_ORIGIN||'http://127.0.0.1:8795')+'/water-ocean-study.html');
 await page.evaluate(()=>waterOceanStudy.dispose());
 await page.setContent('<style>body{margin:0;background:#02121c}canvas{display:block;width:560px;height:560px}</style><canvas></canvas>');
 const status=await page.evaluate(async()=>{window.r=new WaterOceanStudy(document.querySelector('canvas'));r.resize(560,560,1);await r.ready;return {error:r.error,diagnostic:r.diagnostic};});
 if(status.error)throw new Error(JSON.stringify(status));
 const sheet=createCanvas(1120,1120),ctx=sheet.getContext('2d');
 for(const[i,t]of [0.4,1.1,1.8,2.8].entries()){
  const ok=await page.evaluate(t=>{r.draw(t);return {error:r.gl.getError(),ok:!r.error};},t);if(ok.error||!ok.ok)throw new Error(JSON.stringify(ok));
  const png=await page.screenshot();ctx.drawImage(await loadImage(png),(i%2)*560,Math.floor(i/2)*560);
  if(i===1)fs.writeFileSync(path.join(__dirname,'ocean-study-hero.png'),png);
 }
 fs.writeFileSync(path.join(__dirname,'ocean-study-motion.png'),sheet.toBuffer('image/png'));
 console.log('Ocean study compiles and renders at four time samples.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
