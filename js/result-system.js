(function (root) {
  'use strict';
  const C = root.ManaConfig;
  const STATES = Object.freeze({ SETTINGS:'SETTINGS', STANDBY:'STANDBY',
    INTERACTION:'INTERACTION', RESONANCE_COMPLETE:'RESONANCE_COMPLETE', GATHER:'GATHER',
    ELEMENT_REVEAL:'ELEMENT_REVEAL', MANA_SCAN:'MANA_SCAN', RANK_CONFIRM:'RANK_CONFIRM', RESULT:'RESULT' });
  const next = { SETTINGS:['STANDBY'], STANDBY:['INTERACTION'],
    INTERACTION:['RESONANCE_COMPLETE'], RESONANCE_COMPLETE:['GATHER'],
    GATHER:['ELEMENT_REVEAL'], ELEMENT_REVEAL:['MANA_SCAN'],
    MANA_SCAN:['RANK_CONFIRM'], RANK_CONFIRM:['RESULT'], RESULT:[] };
  function validSettings(s) {
    const distributionValid=(weights,keys)=>keys.every(k=>Number.isFinite(weights[k])&&weights[k]>=0)
      &&keys.reduce((sum,k)=>sum+weights[k],0)>0;
    if(['火','水','風','土'].some(k=>s.elements[k])&&!distributionValid(s.normalRanks||C.normalRanks,Object.keys(C.normalRanks)))return false;
    if(['光','暗'].some(k=>s.elements[k])&&!distributionValid(s.rareElementRanks||C.rareElementRanks,['A','S','SS']))return false;
    return Number.isFinite(s.muggleChance) && s.muggleChance >= 0 && s.muggleChance <= 1 &&
      (Object.keys(C.elementWeights).some(k => s.elements[k]) ||
        (s.muggleEnabled && s.muggleChance === 1));
  }
  function weightedPick(weights, random) {
    const entries = Object.entries(weights).filter(([,w]) => w > 0);
    let ticket = random() * entries.reduce((sum,[,w]) => sum+w, 0);
    for (const [key,weight] of entries) { if (ticket < weight) return key; ticket -= weight; }
    return entries.at(-1)[0];
  }
  function createResult(settings, random = Math.random) {
    if (!validSettings(settings)) throw new Error('請開啟至少一個屬性，或啟用 100% 麻瓜。');
    let type = 'magic', element = null, rank;
    if (settings.muggleEnabled && random() < settings.muggleChance) {
      type = 'muggle'; rank = 'MUGGLE';
    } else {
      element = weightedPick(Object.fromEntries(Object.entries(C.elementWeights)
        .filter(([k]) => settings.elements[k])), random);
      let weights=settings.normalRanks||C.normalRanks;
      if(element==='光'||element==='暗'){
        const rare=settings.rareElementRanks||C.rareElementRanks;
        weights=Object.fromEntries(['A','S','SS'].map(k=>[k,rare[k]]));
      }
      rank = weightedPick(weights, random);
    }
    const [min,max] = C.ranks[rank].range;
    return Object.freeze({ type, element, rank, mana: min + Math.floor(random() * (max-min+1)) });
  }
  function rankForNumber(n) {
    for (const code of ['SS','S','A','B','C','D']) if (n >= C.ranks[code].range[0]) return code;
    return 'E';
  }
  class Session {
    constructor() { this.state = STATES.SETTINGS; this.currentResult = null; this.generation = 0; }
    reset() { this.generation++; this.state = STATES.SETTINGS; this.currentResult = null; }
    begin(settings, random) {
      const result = createResult(settings, random);
      this.reset(); this.currentResult = result; this.transition(STATES.STANDBY);
      return result;
    }
    transition(state) {
      if (!next[this.state].includes(state)) throw new Error(`Invalid state: ${this.state} → ${state}`);
      this.state = state;
    }
  }
  root.ManaResults = Object.freeze({ STATES, Session, createResult, validSettings, rankForNumber });
})(globalThis);
