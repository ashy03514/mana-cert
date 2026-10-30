(function(root){
  'use strict';
  class ManaScan {
    constructor(result,config) {this.result=result;this.config=config;this.value=1;this.rank='E';this.warning=false;this.done=false;}
    sample(elapsed) {
      const c=this.config,t=Math.max(0,elapsed);
      this.warning=false;this.done=false;
      {
        const p=Math.min(1,t/c.duration);
        this.value=1+Math.floor((Math.min(999,this.result.mana)-1)*(1-(1-p)*(1-p)));
        this.rank=root.ManaResults.rankForNumber(this.value);this.done=p===1;
      }
      return this;
    }
  }
  root.ManaScan=ManaScan;
})(globalThis);
