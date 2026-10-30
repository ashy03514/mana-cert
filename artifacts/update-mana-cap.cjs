const fs=require('node:fs');
function edit(file,replacements){let s=fs.readFileSync(file,'utf8');for(const [a,b]of replacements){if(!s.includes(a))throw Error(file+' missing '+a);s=s.replaceAll(a,b);}fs.writeFileSync(file,s);}
edit('js/water-rank-effects.js',[["[1000,'SS'","[999,'SS'"]]);
for(const file of ['js/wind-rank-effects.js','js/earth-rank-effects.js'])edit(file,[['750,900,1000','750,900,999']]);
edit('js/light-rank-growth.js',[['>=1000','>=999'],['900 and 1000','900 and 999'],['950+(growth-1)*50','950+(growth-1)*49']]);
edit('js/fire-rank-sparkles.js',[["rank==='SS'?1000","rank==='SS'?999"],['(mana-950)/50','(mana-950)/49']]);
edit('js/light-angel-motion-renderer.js',[['950+50*(g-1)','950+49*(g-1)']]);
edit('js/light-holy-renderer.js',[['mana:1000','mana:999']]);
edit('service-worker.js',[['portal-121','portal-122']]);
// Keep the real formal browser checks on valid outcomes and both S endpoints.
edit('tests/dark-formal-browser.cjs',[["{rank:'SS',mana:1000},{rank:'SS',mana:9999}","{rank:'S',mana:998},{rank:'SS',mana:999}"],['target.mana===9999','target.mana===999'],["'9999'","'999'"]]);
edit('tests/dark-formal-offline-browser.cjs',[['v121','v122'],['portal-121','portal-122'],['?v=121','?v=122'],["['SS',9999]","['SS',999]"]]);
