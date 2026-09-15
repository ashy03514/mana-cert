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
    const ranks=s.normalRanks||C.normalRanks;
    if(!Object.keys(C.normalRanks).every(k=>Number.isFinite(ranks[k])&&ranks[k]>=0)||
      Object.keys(C.normalRanks).reduce((sum,k)=>sum+ranks[k],0)<=0)return false;
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
      rank = weightedPick(element === '光' || element === '暗' ? C.rareElementRanks : settings.normalRanks||C.normalRanks, random);
    }
    const [min,max] = C.ranks[rank].range;
    return Object.freeze({ type, element, rank, mana: min + Math.floor(random() * (max-min+1)) });
  }
  function rankForNumber(n) {
    for (const code of ['S','A','B','C','D']) if (n >= C.ranks[code].range[0]) return code;
    return 'E'; // During SS overflow, S remains visible until confirmation.
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
