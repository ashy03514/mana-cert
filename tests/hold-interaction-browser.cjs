/* Real input and production reveal loop. Device screenshots remain a separate visual check. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.MANA_PLAYWRIGHT_MODULE || 'C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.MANA_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader']
  });
  try {
    const context = await browser.newContext({ viewport: { width: 435, height: 941 }, deviceScaleFactor: 1, hasTouch: true });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    await page.addInitScript(() => {
      let now = 0, serial = 0;
      const pending = new Map();
      Object.defineProperty(performance, 'now', { configurable: true, value: () => now });
      window.requestAnimationFrame = callback => { const id = ++serial; pending.set(id, callback); return id; };
      window.cancelAnimationFrame = id => pending.delete(id);
      window.advanceHoldTest = milliseconds => {
        let remaining = milliseconds;
        do {
          const increment = Math.min(50, remaining);
          now += increment;
          remaining -= increment;
          const callbacks = [...pending.values()];
          pending.clear();
          for (const callback of callbacks) callback(now);
        } while (remaining > 0);
      };
    });
    const url = process.env.MANA_TEST_URL || pathToFileURL(path.resolve(__dirname, '../index.html')).href;
    const advance = milliseconds => page.evaluate(value => window.advanceHoldTest(value), milliseconds);
    const touch = await context.newCDPSession(page);
    const startTouch = (x, y) => touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
    const moveTouch = (x, y) => touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y, id: 1 }] });
    const endTouch = () => touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    const cancelTouch = () => touch.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    const input = (id, value) => page.locator('#' + id).evaluate((element, value) => {
      element.value = value;
      element.dispatchEvent(new Event('input', { bubbles: true }));
    }, value);
    await page.goto(url);
    if (url.startsWith('http')) {
      await page.evaluate(() => navigator.serviceWorker.ready);
      await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { polling: 50 });
      await context.setOffline(true);
      await page.reload();
      assert.equal(await page.evaluate(() => typeof HoldMagic), 'function', 'the PWA serves hold magic offline');
    }
    await page.evaluate(() => {
      const observed = window.holdObserved = { begins: 0 };
      const begin = ManaResults.Session.prototype.begin;
      ManaResults.Session.prototype.begin = function (...args) {
        const result = begin.apply(this, args);
        observed.session = this;
        observed.result = result;
        observed.json = JSON.stringify(result);
        observed.begins++;
        return result;
      };
      const step = RevealFlow.prototype.step;
      RevealFlow.prototype.step = function (...args) { observed.flow = this; return step.apply(this, args); };
      const capture = RevealGather.prototype.capture;
      RevealGather.prototype.capture = function (...args) {
        const result = capture.apply(this, args);
        observed.gather = this;
        observed.source = args[0];
        return result;
      };
      const down = PortalScene.prototype.down;
      PortalScene.prototype.down = function (...args) { observed.scene = this; return down.apply(this, args); };
    });
    const snapshot = () => page.evaluate(() => {
      const s = window.holdObserved;
      return {
        state: s.flow?.state, elapsed: s.flow?.elapsed, hold: s.flow?.holdFrame,
        completionSource: s.flow?.completionSource, begins: s.begins, result: s.result,
        same: s.result === s.session?.currentResult,
        unchanged: s.json === JSON.stringify(s.session?.currentResult),
        frozen: Object.isFrozen(s.session?.currentResult),
        orbCount: s.gather?.orbs?.length,
        strokes: s.scene?.trails.strokes.map(stroke => stroke.points.map(point => ({ x: point.x, y: point.y })))
      };
    });
    const assertStable = async begins => {
      const s = await snapshot();
      assert.equal(s.begins, begins, 'gestures never roll a second result');
      assert.ok(s.same && s.unchanged && s.frozen, 'the initially committed result is immutable');
      assert.equal(await page.locator('#materialError').isVisible(), false);
      assert.deepEqual(errors, []);
    };
    const retry = async () => {
      assert.equal(await page.locator('#formalReplay').isVisible(), true, 'completed appraisal exposes the action star');
      await page.locator('#formalReplay').click({ force: true, noWaitAfter: true });
      await page.locator('#btnRetryCert').click({ force: true, noWaitAfter: true });
      await advance(0);
      assert.equal(await page.locator('body').getAttribute('data-state'), 'STANDBY');
      assert.equal((await snapshot()).state, 'DRAWING');
      assert.equal((await snapshot()).hold, null);
    };
    const image = () => page.locator('#particleCanvas').evaluate(canvas => canvas.toDataURL('image/png'));

    // Force a basic magic outcome through the public settings so result wiring is exercised.
    await page.locator('#s_muggle').uncheck({ force: true });
    for (const name of ['water', 'wind', 'earth', 'light', 'dark']) await page.locator('#s_' + name).uncheck({ force: true });
    await page.locator('#tab_probabilities').click({ force: true, noWaitAfter: true });
    for (const rank of ['E', 'D', 'C', 'B', 'A', 'S', 'SS']) await input('chance_' + rank, rank === 'E' ? '100' : '0');
    await page.locator('#btnStart').click({ force: true, noWaitAfter: true });
    await advance(0);
    assert.equal((await snapshot()).result.element, '火');
    const prompt = await page.locator('#waitingPrompt').boundingBox();
    await startTouch(218, prompt.y + 12);
    assert.equal(await page.locator('#waitingPrompt').isVisible(), false, 'touching the prompt itself starts the interaction');
    await advance(300);
    for (const offset of [3, -3, 2, -2]) { await moveTouch(218 + offset, prompt.y + 12); await advance(50); }
    await endTouch();
    await advance(2200);
    assert.equal((await snapshot()).state, 'DRAWING', 'short stationary touch and jitter cannot finish an appraisal');

    await startTouch(140, 435);
    await advance(1300);
    assert.equal((await snapshot()).hold.ready, true);
    await page.screenshot({ path: path.join(os.tmpdir(), 'mana-hold-charged.png') });
    const heldImage = await image();
    await advance(300);
    assert.notEqual(await image(), heldImage, 'stationary charging remains animated');
    await advance(2300);
    assert.equal((await snapshot()).state, 'DRAWING', 'holding never auto-releases the appraisal');
    await endTouch();
    assert.equal((await snapshot()).state, 'RETURN');
    await advance(250);
    await page.screenshot({ path: path.join(os.tmpdir(), 'mana-hold-return.png') });
    await advance(350);
    assert.equal((await snapshot()).state, 'WAITING');
    await advance(1700);
    let s = await snapshot();
    assert.equal(s.state, 'GATHER');
    assert.ok(s.orbCount >= 32, 'stationary hold supplies a complete cloud of release particles');
    await assertStable(1);
    const beforePause = s.elapsed;
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    await advance(3000);
    assert.equal((await snapshot()).elapsed, beforePause, 'background time cannot advance the gather');
    await page.evaluate(() => window.dispatchEvent(new Event('pageshow')));
    await advance(0);
    await advance(10000);
    assert.equal(Number(await page.locator('#fireScanValue').textContent()), s.result.mana);
    assert.equal(await page.locator('#fireScanRank').getAttribute('data-rank'), 'E');
    await assertStable(1);
    await retry();

    await startTouch(180, 430);
    await advance(1400);
    await cancelTouch();
    await advance(2000);
    assert.equal((await snapshot()).state, 'DRAWING', 'OS cancellation cannot release stored magic');
    await startTouch(180, 430);
    await advance(300);
    assert.equal((await snapshot()).hold.ready, false, 'a new press starts its charge from zero');
    await endTouch();
    await advance(2000);
    assert.equal((await snapshot()).state, 'DRAWING');
    await startTouch(180, 430);
    await advance(600);
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    await advance(5000);
    await page.evaluate(() => window.dispatchEvent(new Event('pageshow')));
    await advance(0);
    await endTouch();
    await advance(2000);
    assert.equal((await snapshot()).state, 'DRAWING', 'background cancellation cannot count toward a hold');

    await startTouch(140, 400);
    await advance(800);
    await moveTouch(190, 370);
    await moveTouch(235, 420);
    await moveTouch(170, 470);
    await advance(300);
    assert.equal((await snapshot()).hold, null, 'a deliberate drag becomes the existing drawing gesture');
    const points = (await snapshot()).strokes.at(-1);
    assert.ok(points.length >= 3, 'converting a hold retains the real drawn stroke');
    assert.ok(points.every(p => p.x >= 130 && p.x <= 245 && p.y >= 360 && p.y <= 480), 'hold-to-draw adds no synthetic jump to the screen center');
    await endTouch();
    assert.equal((await snapshot()).state, 'WAITING', 'drawing keeps its original release timing');
    await advance(1800);
    assert.equal((await snapshot()).state, 'GATHER');
    await assertStable(2);
    await advance(10000);
    await retry();

    await page.mouse.move(130, 420);
    await page.mouse.down();
    await page.mouse.move(225, 340, { steps: 5 });
    await page.mouse.move(270, 460, { steps: 5 });
    await page.mouse.up();
    assert.equal((await snapshot()).state, 'WAITING', 'direct drawing is still supported');
    await advance(12000);
    await assertStable(3);
    await page.locator('#formalReplay').click({ force: true, noWaitAfter: true });
    await page.locator('#btnGoHome').click({ force: true, noWaitAfter: true });
    await page.locator('#tab_effects').click({ force: true, noWaitAfter: true });
    await page.locator('#effect_trailEnabled').evaluate(element => {
      element.closest('details').open = true;
    });
    await page.locator('#effect_trailEnabled').uncheck({ force: true });
    await page.locator('#btnStart').click({ force: true, noWaitAfter: true });
    await advance(0);
    await startTouch(30, 410);
    await advance(1300);
    await page.screenshot({ path: path.join(os.tmpdir(), 'mana-hold-edge.png') });
    await endTouch();
    await advance(2350);
    s = await snapshot();
    assert.equal(s.state, 'GATHER');
    assert.ok(s.orbCount >= 32, 'turning the ribbon off still allows long-press magic to be released');
    await assertStable(4);
    console.log('PASS real touch hold, jitter, short press, live stationary animation, return and release particles, immutable formal result, retry, cancellation, background time, hold-to-draw, ordinary drawing and disabled ribbons.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
