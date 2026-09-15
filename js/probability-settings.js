/* Keep the edited percentage exact and redistribute the remaining integer percent. */
(function(root){
  'use strict';
  function redistribute(current,code,value){
    const result={...current},others=Object.keys(current).filter(k=>k!==code);
    result[code]=Math.max(0,Math.min(100,Math.round(value)));
    const remaining=100-result[code],total=others.reduce((s,k)=>s+current[k],0);
    const shares=others.map(k=>({key:k,exact:remaining*(total?current[k]/total:1/others.length)}));
    let used=0;for(const s of shares){result[s.key]=Math.floor(s.exact);used+=result[s.key];}
    shares.sort((a,b)=>(b.exact-Math.floor(b.exact))-(a.exact-Math.floor(a.exact)));
    for(let i=0;i<remaining-used;i++)result[shares[i].key]++;
    return result;
  }
  root.ProbabilitySettings={redistribute};
})(globalThis);
