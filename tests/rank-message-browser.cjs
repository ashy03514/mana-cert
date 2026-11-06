/* Real Chrome/Canvas host checks. Device visual acceptance remains separate. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const {pathToFileURL} = require('node:url');
const {chromium} = require(process.env.MANA_PLAYWRIGHT_MODULE || 'C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({headless: true,
    executablePath: process.env.MANA_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader']});
  try {
    const context = await browser.newContext({viewport: {width: 435, height: 941}, deviceScaleFactor: 1});
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    await page.addInitScript(() => {
      let now = 0, id = 0;
      const pending = new Map();
      Object.defineProperty(performance, 'now', {configurable: true, value: () => now});
      window.requestAnimationFrame = callback => {pending.set(++id, callback); return id;};
      window.cancelAnimationFrame = id => pending.delete(id);
      window.advanceRankMessageTest = ms => {
        do {
          const step = Math.min(50, ms); now += step; ms -= step;
          const callbacks = [...pending.values()]; pending.clear();
          callbacks.forEach(callback => callback(now));
        } while (ms > 0);
      };
    });
    const url = process.env.MANA_TEST_URL || pathToFileURL(path.resolve(__dirname, '../index.html')).href;
    await page.goto(url);
    const click = selector => page.locator(selector).click({force: true, noWaitAfter: true});
    const edit = (id, value) => page.locator('#' + id).evaluate((input, value) => {
      input.value = value;
      input.dispatchEvent(new Event('input', {bubbles: true}));
      input.dispatchEvent(new Event('change', {bubbles: true}));
    }, value);
    const message = page.locator('#rankMessage');
    const ranks = ['E', 'D', 'C', 'B', 'A', 'S', 'SS'];
    const editor = page.locator('#rankMessageSettings');
    const openEditor = async () => {
      await click('#tab_switches');
      if (!await editor.evaluate(element => element.open)) await editor.locator('summary').click({force: true});
    };
    assert.equal(await message.isVisible(), false);
    await openEditor();
    for (const rank of ranks) {
      assert.equal(await page.locator('#rankMessage_' + rank).getAttribute('maxlength'), '40');
      await page.locator('#rankMessage_' + rank).fill(rank + ' 級自訂文案');
    }
    await edit('rankMessageSize', 22);
    await page.locator('#rankMessageEnabled').uncheck({force: true});
    await page.reload();
    await openEditor();
    for (const rank of ranks) assert.equal(await page.locator('#rankMessage_' + rank).inputValue(), rank + ' 級自訂文案');
    assert.equal(await page.locator('#rankMessageSize').inputValue(), '22');
    assert.equal(await page.locator('#rankMessageEnabled').isChecked(), false);
    assert.equal(await page.locator('#rankMessageSaveError').isVisible(), false);
    await page.locator('#rankMessageEnabled').check({force: true});
    await edit('rankMessageSize', 16);
    const defaultSS = await page.evaluate(() => RankMessage.defaults.messages.SS);
    await page.locator('#rankMessage_SS').fill(defaultSS);

    // Observe real outcomes and production geometry; only the presentation clock is positioned.
    await page.evaluate(() => {
      window.rankMessageObserved = {begins: 0, layouts: []};
      const begin = ManaResults.Session.prototype.begin;
      ManaResults.Session.prototype.begin = function (...args) {
        const result = begin.apply(this, args);
        Object.assign(rankMessageObserved, {session: this, result, json: JSON.stringify(result), begins: rankMessageObserved.begins + 1});
        return result;
      };
      const reset = RevealFlow.prototype.reset;
      RevealFlow.prototype.reset = function (...args) {rankMessageObserved.flow = this; return reset.apply(this, args);};
      const layout = ResultLayout;
      window.ResultLayout = Object.freeze({...layout, compose(...args) {
        const output = layout.compose(...args);
        rankMessageObserved.layout = {base: args[2], output, options: args[3]};
        return output;
      }});
      const Light = LightAngelLayeredGrowthRenderer;
      window.LightAngelLayeredGrowthRenderer = class extends Light {
        constructor(...args) {super(...args); rankMessageObserved.light = this;}
      };
    });
    const immutable = async () => assert.equal(await page.evaluate(() => {
      const observed = rankMessageObserved;
      return observed.result === observed.session.currentResult && Object.isFrozen(observed.result) &&
        observed.json === JSON.stringify(observed.result);
    }), true, 'Presentation leaves the actual selected result frozen and unchanged');
    const choose = async element => {
      await click('#tab_switches');
      for (const name of ['fire','water','wind','earth','lightning','light','dark','muggle']) {
        await page.locator('#s_' + name).setChecked(name === element, {force: true});
      }
      await page.locator('#soundEnabled').uncheck({force: true});
      await click('#tab_probabilities');
      if (element === 'muggle') await edit('muggleChance', 100);
      else for (const rank of element === 'light' ? ['A','S','SS'] : ranks) {
        await edit((element === 'light' ? 'rareChance_' : 'chance_') + rank, rank === 'SS' ? 100 : 0);
      }
    };
    const start = async element => {
      await click('#btnStart');
      await page.evaluate(() => advanceRankMessageTest(0));
      assert.equal(await message.isVisible(), false, 'A new round starts without stale visible copy');
      if (element === 'light') await page.waitForFunction(() => rankMessageObserved.light?.loaded && LightFeathers.loaded, null, {polling: 50});
      // The controlled RAF needs a repaint after async assets finish, just as
      // the real render loop clears the loading overlay on the next frame.
      await page.evaluate(() => advanceRankMessageTest(0));
      assert.equal(await page.locator('#materialError').isVisible(),false);
      assert.equal(await page.evaluate(() => rankMessageObserved.result.type), element === 'muggle' ? 'muggle' : 'magic');
      if (element !== 'muggle') assert.equal(await page.evaluate(() => rankMessageObserved.result.rank), 'SS');
      await immutable();
      await page.mouse.move(180,400); await page.mouse.down();
      await page.mouse.move(270,480,{steps:4}); await page.mouse.up();
      assert.equal(await page.locator('#waitingPrompt').isVisible(),false,'Accepted gesture dismisses standby copy');
    };
    const at = elapsed => page.evaluate(elapsed => {
      const flow = rankMessageObserved.flow;
      flow.paused = true; flow.state = 'REVEAL'; flow.elapsed = elapsed;
      advanceRankMessageTest(50);
    }, elapsed);
    const opacity = () => message.evaluate(element => Number(getComputedStyle(element).opacity));
    const openActions = async () => {
      const button = await page.locator('#formalReplay').boundingBox();
      assert.ok(button, 'Action star is visible');
      await page.mouse.click(button.x + button.width / 2, button.y + button.height / 2);
      assert.equal(await page.locator('#resultActionSheet').getAttribute('aria-hidden'), 'false', 'Star remains clickable');
    };
    const home = async () => {
      await immutable(); await openActions(); await click('#btnGoHome');
      assert.equal(await message.isVisible(), false, 'Returning home hides the result message');
    };
    const geometry = async () => {
      const geometry = await page.evaluate(() => {
        const box = element => {const r = element.getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,right:r.right};};
        const rank = document.getElementById('fireScanRank'), message = document.getElementById('rankMessage');
        const rankBox = box(rank), font = parseFloat(getComputedStyle(rank).fontSize);
        // The full SS star envelope: max center y 108%, max size .234 em,
        // arbitrary rotation, and the existing six-pixel glow.
        const sparkleBottom = rankBox.bottom + rankBox.height * .08 + font * .234 * Math.SQRT2 / 2 + 6;
        const {base, output} = rankMessageObserved.layout;
        return {message: box(message), rank: rankBox, sparkleBottom, button: box(document.getElementById('formalReplay')),
          pointer: getComputedStyle(message).pointerEvents, font: getComputedStyle(message).fontSize,
          scale: output.composition.scale, baseBox: base.box, effectBox: output.box,
          viewport: {width: innerWidth, height: innerHeight}};
      });
      assert.equal(geometry.effectBox.width, geometry.baseBox.width, 'Authored effect width is preserved');
      assert.equal(geometry.effectBox.height, geometry.baseBox.height, 'Authored effect height is preserved');
      assert.equal(geometry.scale, 1);
      assert.ok(geometry.sparkleBottom < geometry.message.y, 'Full rank sparkle envelope clears the message: ' + JSON.stringify(geometry));
      assert.ok(geometry.message.bottom < geometry.button.y - 12, 'Message clears the action star by over 12 px');
      assert.ok(geometry.message.x >= 0 && geometry.message.right <= geometry.viewport.width && geometry.message.y >= 0,
        'Message remains inside the viewport');
      assert.equal(geometry.pointer, 'none');
      return geometry;
    };

    await choose('fire'); await start('fire');
    assert.equal(await page.evaluate(() => rankMessageObserved.result.element), '火');
    await page.evaluate(() => advanceRankMessageTest(10000));
    assert.equal(await message.isVisible(),true,'Real drawing-to-result loop reveals the final copy');
    await immutable();
    for (const time of [.8, 2, 4.05, 4.3]) {
      await at(time); assert.equal(await message.isVisible(), false, 'No copy during scan or the final 300 ms delay at ' + time);
    }
    await at(4.5); assert.ok(Math.abs(await opacity() - .31640625) < 1e-6, 'Basic copy fades after the existing 4.05 s completion plus 300 ms');
    await at(4.8); assert.equal(await opacity(), 1); assert.equal(await message.textContent(), defaultSS);
    assert.equal(await page.locator('#fireScanRank .rankText').textContent(), 'SS');
    await geometry(); await immutable();
    const fireScreenshot = path.join(os.tmpdir(), 'mana-rank-message-v165-fire-SS.png');
    await page.screenshot({path: fireScreenshot});
    const begins = await page.evaluate(() => rankMessageObserved.begins);
    await openActions(); await click('#btnRetryCert');
    assert.equal(await page.evaluate(() => rankMessageObserved.begins), begins + 1);
    assert.equal(await message.isVisible(), false, 'Retry clears the previous result copy');
    await page.mouse.move(180,400); await page.mouse.down();
    await page.mouse.move(270,480,{steps:4}); await page.mouse.up();
    await at(4.8); await home();

    await choose('light'); await start('light');
    assert.equal(await page.evaluate(() => rankMessageObserved.result.element), '光');
    const completeAt = await page.evaluate(() => LightRankGrowth.sample(20, rankMessageObserved.result).completeAt);
    assert.ok(completeAt > 4, 'Light SS includes its final wing/color evolution');
    await at(4.05); assert.equal(await message.isVisible(), false, 'Numeric completion cannot bypass rare-element evolution');
    await at(completeAt + .29); assert.equal(await message.isVisible(), false);
    await at(completeAt + .5); assert.ok(await opacity() > .45 && await opacity() < .55);
    await at(completeAt + .8); assert.equal(await opacity(), 1); assert.equal(await message.textContent(), defaultSS);
    await geometry(); await immutable();
    const lightScreenshot = path.join(os.tmpdir(), 'mana-rank-message-v165-light-SS.png');
    await page.screenshot({path: lightScreenshot});
    await home();

    await openEditor();
    const literal = '<b>星光</b> & 最終文案';
    await page.locator('#rankMessage_SS').fill(literal);
    await start('light'); await at(20);
    assert.equal(await message.textContent(), literal);
    assert.equal(await message.evaluate(element => element.childElementCount), 0, 'Markup remains literal text');
    await home();

    await openEditor(); await page.locator('#rankMessageEnabled').uncheck({force: true});
    await start('light'); await at(20); assert.equal(await message.isVisible(), false, 'Global switch suppresses final copy'); await home();
    await openEditor(); await page.locator('#rankMessageEnabled').check({force: true}); await page.locator('#rankMessage_SS').fill('');
    await start('light'); await at(20); assert.equal(await message.isVisible(), false, 'Blank final-rank copy is suppressed'); await home();

    await openEditor();
    const longCopy = '魔'.repeat(40);
    await page.locator('#rankMessage_SS').fill(longCopy); await edit('rankMessageSize', 22);
    await start('light'); await at(20);
    const wrapped = await geometry();
    assert.ok(wrapped.message.height > 22 * 1.55 * 2, 'Forty large Chinese characters wrap across multiple measured lines');
    assert.equal(wrapped.font, '22px');
    await home();
    await choose('muggle'); await start('muggle'); await at(20);
    assert.equal(await message.isVisible(), false, 'Muggle has no rank-specific copy'); await home();
    await click('#tab_effects'); await click('#effectPreview');
    assert.equal(await message.isVisible(), false, 'Settings effect preview has no final-rank message');
    assert.deepEqual(errors, []);

    if (url.startsWith('http')) {
      await page.evaluate(() => navigator.serviceWorker.ready);
      await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), null, {polling: 50});
      const cached = await page.evaluate(async () => {
        const name = 'mana-pwa-v3-portal-' + document.getElementById('appVersion').dataset.version;
        return Boolean(await (await caches.open(name)).match('./js/rank-message.js'));
      });
      assert.equal(cached, true, 'Loaded version caches the rank-message module');
      await context.setOffline(true);
      const offline = await context.newPage(); // Normal clock for navigation/PWA lifecycle.
      offline.on('pageerror', error => errors.push(String(error)));
      await offline.goto(url); await offline.reload();
      assert.equal(await offline.evaluate(() => typeof RankMessage.frame), 'function');
      assert.equal(await offline.locator('#rankMessageFields input').count(), 7);
      assert.equal(await offline.locator('#rankMessage_SS').inputValue(), longCopy);
      assert.equal(await offline.locator('#rankMessageSize').inputValue(), '22');
      assert.equal(await offline.locator('#appVersion').getAttribute('data-version'), await page.locator('#appVersion').getAttribute('data-version'));
      await context.setOffline(false);
      assert.deepEqual(errors, []);
    }
    console.log('PASS seven settings/reload, final-only basic/rare fade, immutable real outcomes, native DOM wrapping and sparkle clearance, literal/disabled/blank/muggle, retry/home/preview, and offline module.');
    console.log('Screenshots: ' + fireScreenshot + '; ' + lightScreenshot);
  } finally {
    await browser.close();
  }
})().catch(error => {console.error(error); process.exitCode = 1;});
