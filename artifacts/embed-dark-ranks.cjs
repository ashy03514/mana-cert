const fs=require('node:fs');
const ranks=Object.fromEntries(['A','S'].map(rank=>[rank,'data:image/png;base64,'+fs.readFileSync(`assets/dark-demon-wings-${rank.toLowerCase()}-v1.png`).toString('base64')]));
fs.writeFileSync('assets/dark-demon-wings-ranks.local.js','/* Generated A/S art, embedded for file:// and offline use. */\nglobalThis.DarkDemonWingRankAssets='+JSON.stringify(ranks)+';\n');
console.log('Embedded dark A/S assets.');
