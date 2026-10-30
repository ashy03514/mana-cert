'use strict';
// Keep the version baked into the served HTML in sync with its PWA cache.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),htmlPath=path.join(root,'index.html'),swPath=path.join(root,'service-worker.js');
const html=fs.readFileSync(htmlPath,'utf8'),sw=fs.readFileSync(swPath,'utf8');
const badge=/<span id="appVersion" data-version="(\d+)" title="目前載入頁面的版本">目前版本 v(\d+)<\/span>/;
const cache=/const CACHE_NAME = "mana-pwa-v3-portal-(\d+)";/;
const htmlMatch=html.match(badge),swMatch=sw.match(cache);
if(!htmlMatch||!swMatch)throw Error('Version markers missing; no files changed.');
if(htmlMatch[1]!==htmlMatch[2]||htmlMatch[1]!==swMatch[1])throw Error('Page/cache versions differ; reconcile before bumping.');
const arg=process.argv[2];
if(arg==='--check'){console.log(`PASS page and PWA cache both v${swMatch[1]}`);process.exit(0);}
const version=Number(swMatch[1])+1;
if(arg)throw Error('Usage: node scripts/bump-version.cjs [--check]');
fs.writeFileSync(htmlPath,html.replace(badge,`<span id="appVersion" data-version="${version}" title="目前載入頁面的版本">目前版本 v${version}</span>`));
fs.writeFileSync(swPath,sw.replace(cache,`const CACHE_NAME = "mana-pwa-v3-portal-${version}";`));
console.log(`Updated page and PWA cache to v${version}`);
