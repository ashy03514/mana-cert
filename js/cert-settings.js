/* Device preferences only. Never persist an in-progress or completed result. */
(function(root){
 'use strict';
 const key='mana-cert-settings-v1';
 function normalize(value,defaults){
  const data=value&&typeof value==='object'?value:{};
  const bool=(v,f)=>typeof v==='boolean'?v:f;
  const distribution=(v,f)=>{
   const keys=Object.keys(f);
   return v&&keys.every(k=>Number.isInteger(v[k])&&v[k]>=0&&v[k]<=100)&&keys.reduce((n,k)=>n+v[k],0)===100
    ?Object.fromEntries(keys.map(k=>[k,v[k]])):{...f};
  };
  return {elements:Object.fromEntries(Object.entries(defaults.elements).map(([k,v])=>[k,bool(data.elements?.[k],v)])),
   muggleEnabled:bool(data.muggleEnabled,defaults.muggleEnabled),
   soundEnabled:bool(data.soundEnabled,defaults.soundEnabled),hapticsEnabled:bool(data.hapticsEnabled,defaults.hapticsEnabled),
   mugglePercent:Number.isInteger(data.mugglePercent)&&data.mugglePercent>=0&&data.mugglePercent<=100?data.mugglePercent:defaults.mugglePercent,
   normalRanks:distribution(data.normalRanks,defaults.normalRanks),rareElementRanks:distribution(data.rareElementRanks,defaults.rareElementRanks)};
 }
 function load(storage,defaults){try{const stored=JSON.parse(storage?.getItem(key)||'null');return normalize(stored?.version===1?stored.settings:null,defaults);}catch(_){return normalize(null,defaults);}}
 function save(storage,settings){try{if(!storage)return false;storage.setItem(key,JSON.stringify({version:1,settings}));return true;}catch(_){return false;}}
 root.CertSettings=Object.freeze({key,normalize,load,save});
})(globalThis);
