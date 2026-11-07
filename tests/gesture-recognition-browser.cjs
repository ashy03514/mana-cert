/* Real touch recognition and production hold rendering; device hand-feel is separate. */
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
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    await page.addInitScript(() => {
      let now = 0, serial = 0;
      const pending = new Map();
      Object.defineProperty(performance, 'now', { configurable: true, value: () => now });
      window.requestAnimationFrame = callback => { pending.set(++serial, callback); return serial; };
      window.cancelAnimationFrame = id => pending.delete(id);
      window.advanceGestureTest = milliseconds => {
        do {
          const increment = Math.min(50, milliseconds);
          now += increment; milliseconds -= increment;
          const callbacks = [...pending.values()]; pending.clear();
          callbacks.forEach(callback => callback(now));
        } while (milliseconds > 0);
      };
    });
    const url = process.env.MANA_TEST_URL || pathToFileURL(path.resolve(__dirname, '../index.html')).href;
    await page.goto(url);
    const advance = ms => page.evaluate(ms => window.advanceGestureTest(ms), ms);
    const click = selector => page.locator(selector).click({ force: true, noWaitAfter: true });
    const touch = await context.newCDPSession(page);
    const down = (x, y) => touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
    const move = (x, y) => touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y, id: 1 }] });
    const moveAndWait = async (x, y) => {
      await move(x, y);
      // CDP may acknowledge before Chromium delivers a coalesced pointermove.
      // Advance the deterministic clock only after the tested motion arrives.
      await page.waitForFunction(({ x, y }) => {
        const last = window.gestureObserved.lastMove;
        return last?.x === x && last?.y === y;
      }, { x, y }, { polling: 10 });
    };
    const up = () => touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    const cancel = () => touch.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    await page.evaluate(() => {
      const observed = window.gestureObserved = { begins: 0, moves: 0 };
      const begin = ManaResults.Session.prototype.begin;
      ManaResults.Session.prototype.begin = function (...args) {
        const result = begin.apply(this, args);
        Object.assign(observed, { session: this, result, json: JSON.stringify(result), begins: observed.begins + 1 });
        return result;
      };
      for (const [Type, method, field] of [[RevealFlow, 'step', 'flow'], [TapStars, 'step', 'stars'],
        [HoldMagic, 'step', 'hold'], [PortalScene, 'down', 'scene']]) {
        const original = Type.prototype[method];
        Type.prototype[method] = function (...args) { observed[field] = this; return original.apply(this, args); };
      }
      const move = RevealFlow.prototype.move;
      RevealFlow.prototype.move = function (...args) {
        observed.moves++; observed.lastMove = { x: args[1], y: args[2] };
        return move.apply(this, args);
      };
      const capture = RevealGather.prototype.capture;
      RevealGather.prototype.capture = function (...args) {
        observed.gather = this; observed.source = args[0]; return capture.apply(this, args);
      };
    });
    const snapshot = () => page.evaluate(() => {
      const o = window.gestureObserved, trails = o.scene?.trails;
      return {
        state: o.flow?.state, source: o.flow?.completionSource, hold: o.flow?.holdFrame,
        pointerId: o.scene?.pointer.id, holdAlpha: o.hold?.alpha,
        holdPosition: o.hold ? { x: o.hold.x, y: o.hold.y } : null,
        grains: o.hold?.grains.filter(g => g.alpha > .01).length || 0,
        stars: o.stars?.stars.map(s => ({ x: s.x, y: s.y })) || [], links: o.stars?.linkCount,
        strokes: trails?.strokes.filter(s => s.points.length > 1).length || 0,
        sourceStrokes: o.source?.strokes.length || 0, sourceParticles: o.source?.holdParticles?.length || 0,
        orbs: o.gather?.orbs.length || 0, moves: o.moves, begins: o.begins,
        stable: o.result === o.session?.currentResult && Object.isFrozen(o.result) && o.json === JSON.stringify(o.session.currentResult)
      };
    });
    // Use an actual immutable muggle result, avoiding unrelated material shaders.
    await page.locator('#s_muggle').check({ force: true }); await click('#tab_probabilities');
    await page.locator('#muggleChance').evaluate(el => { el.value = '100'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    await click('#btnStart'); await advance(0);

    const taps = [];
    for (let i = 0; i < 12; i++) {
      const x = 60 + i % 4 * 90, y = 220 + Math.floor(i / 4) * 120;
      taps.push({ x, y });
      await down(x, y); await advance(30); await moveAndWait(x + 18 + i % 3 * 2, y);
      await advance(30); await up(); await advance(20);
      const s = await snapshot();
      assert.equal(s.stars.length, i + 1, 'each fast jittered tap creates exactly one star');
      assert.equal(s.strokes, 0, '18–22 px of landing/lift movement does not become brush ink');
    }
    let s = await snapshot();
    assert.deepEqual(s.stars, taps); assert.equal(s.links, 66);
    assert.ok(s.moves >= 12, 'the test actually delivered movement to the production recognizer');

    // Synthetic input is only used to isolate the release-coordinate anomaly.
    await page.evaluate(() => document.getElementById('animLayer').dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true, pointerId: 900, pointerType: 'touch', isPrimary: true, button: 0, clientX: 180, clientY: 530
    })));
    await advance(40);
    await page.evaluate(() => window.dispatchEvent(new PointerEvent('pointerup', {
      bubbles: true, pointerId: 900, pointerType: 'touch', isPrimary: true, button: 0, clientX: 218, clientY: 550
    })));
    await advance(0); s = await snapshot();
    assert.equal(s.stars.length, 13); assert.equal(s.strokes, 0, 'pointerup alone cannot start a brush stroke');
    assert.deepEqual(s.stars.at(-1), { x: 180, y: 530 });

    await down(90, 650); await advance(30); await moveAndWait(180, 650); await advance(30); await up();
    s = await snapshot();
    assert.equal(s.stars.length, 13, 'a deliberate fast swipe does not become a tap');
    assert.equal(s.strokes, 1);

    await down(100, 570); await advance(40); await move(140, 570); await cancel(); await advance(400);
    s = await snapshot(); assert.equal(s.state, 'DRAWING'); assert.equal(s.pointerId, null); assert.equal(s.stars.length, 13);
    await down(80, 600); await move(120, 600); await advance(150);
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide'))); await advance(5000);
    await page.evaluate(() => window.dispatchEvent(new Event('pageshow'))); await up(); await advance(400);
    s = await snapshot(); assert.equal(s.state, 'DRAWING'); assert.equal(s.pointerId, null);
    assert.equal(s.stars.length, 13, 'pause/cancel do not create taps or carry a hold across background time');

    await down(100, 700); await move(130, 700);
    for (let i = 1; i <= 40; i++) {
      await advance(100); await move(130 + i * 4, 700);
      s = await snapshot(); assert.equal(s.state, 'DRAWING'); assert.equal(s.source, null);
      assert.equal(s.hold, null, 'slow continuous drawing stays a stroke instead of repeatedly charging');
    }
    // Tiny touch updates can be coalesced by Chromium. Finish with a clear
    // movement so the following timing assertion has an exact new quiet clock.
    await moveAndWait(310, 700); await advance(0);
    await advance(340); assert.equal((await snapshot()).hold, null);
    await advance(20); s = await snapshot();
    assert.ok(s.hold?.active && s.holdAlpha > 0, 'RAF detects a stopped drawing without another pointer event');
    assert.deepEqual({ x: s.hold.x, y: s.hold.y }, { x: 310, y: 700 }, 'charge begins at the stopped fingertip');
    await advance(500); s = await snapshot();
    assert.ok(s.grains > 0, 'the recovered hold has visible energy grains');
    assert.ok(s.strokes > 0 && s.stars.length === 13 && s.links === 78, 'ink, stars and recovered hold coexist');
    const screenshot = path.join(os.tmpdir(), 'mana-gesture-hold-recovery.png');
    await page.screenshot({ path: screenshot });

    await moveAndWait(350, 690); await advance(0); s = await snapshot();
    assert.equal(s.hold, null, 'meaningful movement immediately resumes drawing and clears charge time');
    await moveAndWait(330, 650); await advance(340); assert.equal((await snapshot()).hold, null);
    await advance(20); s = await snapshot(); assert.ok(s.hold?.active);
    assert.deepEqual({ x: s.hold.x, y: s.hold.y }, { x: 330, y: 650 });
    await advance(2600); assert.equal((await snapshot()).state, 'DRAWING', 'new motion restarts the full three-second charge');
    await advance(60); s = await snapshot();
    assert.equal(s.state, 'WAITING'); assert.equal(s.source, 'autoHold'); assert.equal(s.pointerId, null);
    await up(); await advance(1700); s = await snapshot();
    assert.equal(s.state, 'GATHER'); assert.equal(s.stars.length, 13, 'draw→hold→release never manufactures another star');
    assert.ok(s.sourceStrokes > 0 && s.sourceParticles > 0 && s.orbs > 0);
    assert.equal(s.begins, 1); assert.ok(s.stable, 'recognition changes cannot reroll or mutate the certification');
    assert.deepEqual(errors, []);

    if (url.startsWith('http')) {
      await page.evaluate(() => navigator.serviceWorker.ready);
      await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), null, { polling: 50 });
      const version = await page.locator('#appVersion').getAttribute('data-version');
      await context.setOffline(true); await page.reload();
      assert.equal(await page.locator('#appVersion').getAttribute('data-version'), version);
      assert.equal(await page.evaluate(() => typeof RevealFlow), 'function');
      assert.equal(await page.evaluate(() => typeof TapStars), 'function');
      assert.deepEqual(errors, []);
    }
    console.log('PASS rapid jittered taps, release-only displacement, deliberate swipe, cancellation/pause, slow drawing, draw/hold recovery and movement reset, mixed sources, immutable result and optional offline cache.');
    console.log('Recovered hold screenshot: ' + screenshot);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
