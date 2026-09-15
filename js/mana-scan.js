(function(root){
  'use strict';
  class ManaScan {
    constructor(result,config) {this.result=result;this.config=config;this.value=1;this.rank='E';this.warning=false;this.done=false;}
    sample(elapsed) {
      const c=this.config,t=Math.max(0,elapsed);
      this.warning=false;this.done=false;
      if(this.result.rank!=='SS') {
        const p=Math.min(1,t/c.duration);
        this.value=1+Math.floor((this.result.mana-1)*(1-(1-p)*(1-p)));
        this.rank=root.ManaResults.rankForNumber(this.value);this.done=p===1;
      } else {
        const rushEnd=c.ssNormalDuration+c.ssRushDuration;
        this.warning=t>=c.ssNormalDuration;
        if(t<c.ssNormalDuration) this.value=1+Math.floor((c.ssStart-2)*t/c.ssNormalDuration);
        else if(t<rushEnd) this.value=c.ssStart+Math.floor((c.ssLimit-c.ssStart)*Math.pow((t-c.ssNormalDuration)/c.ssRushDuration,1.5));
        else if(t<rushEnd+c.ssLimitHold)this.value=c.ssLimit;
        else this.value='????';
        this.done=t>=rushEnd+c.ssLimitHold+c.ssUnknownHold;
        this.rank=this.done?'SS':root.ManaResults.rankForNumber(typeof this.value==='number'?this.value:c.ssLimit);
      }
      return this;
    }
  }
  root.ManaScan=ManaScan;
})(globalThis);
