/* Real touch input and production rendering. Device hand-feel remains separate. */
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
      window.advanceTapTest = milliseconds => {
        do {
          const step = Math.min(50, milliseconds);
          now += step; milliseconds -= step;
          const callbacks = [...pending.values()]; pending.clear();
          callbacks.forEach(callback => callback(now));
        } while (milliseconds > 0);
      };
    });
    const url = process.env.MANA_TEST_URL || pathToFileURL(path.resolve(__dirname, '../index.html')).href;
    await page.goto(url);
    const advance = ms => page.evaluate(ms => window.advanceTapTest(ms), ms);
    const click = selector => page.locator(selector).click({ force: true, noWaitAfter: true });
    const input = (id, value) => page.locator('#' + id).evaluate((el, value) => {
      el.value = value; el.dispatchEvent(new Event('input', { bubbles: true }));
    }, value);
    const touch = await context.newCDPSession(page);
    const down = (x, y) => touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
    const move = (x, y) => touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y, id: 1 }] });
    const up = () => touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    const cancel = () => touch.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    const tap = async (x, y) => { await down(x, y); await advance(100); await up(); await advance(0); };

    await page.evaluate(() => {
      const observed = window.tapObserved = { begins: 0 };
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
      const capture = RevealGather.prototype.capture;
      RevealGather.prototype.capture = function (...args) {
        observed.gather = this; observed.source = args[0];
        return capture.apply(this, args);
      };
    });
    const snapshot = () => page.evaluate(() => {
      const o = window.tapObserved, stars = o.stars?.stars || [], trails = o.scene?.trails;
      return {
        state: o.flow?.state, elapsed: o.flow?.elapsed, completionSource: o.flow?.completionSource,
        hold: o.flow?.holdFrame, holdAlpha: o.hold?.alpha, holdMode: o.hold?.mode,
        holdPosition: o.hold ? { x: o.hold.x, y: o.hold.y } : null, pointerId: o.scene?.pointer.id,
        stars: stars.map(s => ({ x: s.x, y: s.y })), links: o.stars?.linkCount,
        strokes: trails?.strokes.map(s => ({ points: s.points.length, opacity: trails.opacity(s) })) || [],
        sourceStrokes: o.source?.strokes?.filter(s => s.points.length > 1).length || 0,
        sourceParticles: o.source?.holdParticles?.map(s => ({ x: s.x, y: s.y })) || [],
        orbs: o.gather?.orbs.length || 0, gatherOpacity: o.gather?.opacity, begins: o.begins,
        stable: o.result === o.session?.currentResult && Object.isFrozen(o.result) && o.json === JSON.stringify(o.session.currentResult)
      };
    });
    const stable = async expectedBegins => {
      const s = await snapshot();
      assert.equal(s.begins, expectedBegins, 'input cannot roll another certification result');
      assert.ok(s.stable, 'the selected result remains frozen and unchanged');
      assert.equal(await page.locator('#materialError').isVisible(), false);
      assert.deepEqual(errors, []);
    };
    const finish = async () => { await advance(16000); assert.equal(await page.locator('#formalReplay').isVisible(), true); };
    const retry = async () => {
      await click('#formalReplay'); await click('#btnRetryCert'); await advance(0);
      const s = await snapshot();
      assert.equal(s.state, 'DRAWING'); assert.deepEqual(s.stars, []); assert.equal(s.links, 0);
    };
    // A no-element result exercises the real session and retry controls without
    // repeatedly rendering unrelated material shaders on software-only runners.
    await page.locator('#s_muggle').check({ force: true });
    await click('#tab_probabilities');
    await input('muggleChance', 100);
    await click('#btnStart'); await advance(0);

    const points = [[92, 310], [321, 355], [218, 550]];
    for (const [x, y] of points) { await tap(x, y); await advance(200); }
    let s = await snapshot();
    assert.equal(s.state, 'WAITING'); assert.equal(s.links, 3, 'every star connects to every other star');
    assert.deepEqual(s.stars, points.map(([x, y]) => ({ x, y })), 'tap stars remain at their actual contact coordinates');
    assert.deepEqual(s.strokes, [], 'a tap does not leave an extra one-point ribbon');
    const starPixels = await page.evaluate(() => {
      const field = window.tapObserved.stars, c = document.createElement('canvas');
      c.width = field.width; c.height = field.height;
      const ctx = c.getContext('2d', { willReadFrequently: true }); field.draw(ctx);
      const alphaNear = (x, y, radius) => {
        const pixels = ctx.getImageData(Math.round(x) - radius, Math.round(y) - radius, radius * 2 + 1, radius * 2 + 1).data;
        return Array.from(pixels).some((value, index) => index % 4 === 3 && value > 4);
      };
      const [a, b] = field.stars;
      return { stars: field.stars.every(p => alphaNear(p.x, p.y, 6)), link: alphaNear((a.x + b.x) / 2, (a.y + b.y) / 2, 2) };
    });
    assert.ok(starPixels.stars && starPixels.link, 'the production renderer emits visible star and connecting-line pixels');
    await advance(1400); assert.equal((await snapshot()).state, 'WAITING');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(() => window.tapObserved.stars.width === 390, null, { polling: 50 }); await advance(0);
    s = await snapshot();
    s.stars.forEach((star, index) => {
      assert.ok(Math.abs(star.x - points[index][0] * 390 / 435) < .01);
      assert.ok(Math.abs(star.y - points[index][1] * 844 / 941) < .01);
    });
    await page.setViewportSize({ width: 435, height: 941 });
    await page.waitForFunction(() => window.tapObserved.stars.width === 435, null, { polling: 50 }); await advance(0);
    assert.equal((await snapshot()).state, 'WAITING', 'resizing preserves the pending inactivity countdown');

    await down(80, 590); await move(145, 615); await move(220, 580); await move(345, 620); await advance(100); await up();
    s = await snapshot();
    assert.equal(s.stars.length, 3, 'drawing never creates a tap star');
    assert.equal(s.strokes.filter(stroke => stroke.points > 1).length, 1);
    await advance(800); await down(195, 380); await advance(1400);
    s = await snapshot();
    assert.equal(s.state, 'DRAWING'); assert.ok(s.hold.active && s.holdAlpha > 0);
    assert.equal(s.stars.length, 3); assert.equal(s.links, 3);
    assert.ok(s.strokes.some(stroke => stroke.points > 1 && stroke.opacity > .9), 'previous drawing remains alongside stars and the charging ring');
    const screenshot = path.join(os.tmpdir(), 'mana-tap-mixed.png');
    await page.screenshot({ path: screenshot });
    await up();
    assert.equal((await snapshot()).state, 'WAITING', 'an early hold release starts the same resumable quiet period');
    await advance(1000); await tap(350, 265);
    s = await snapshot(); assert.equal(s.stars.length, 4); assert.equal(s.links, 6);
    assert.equal(s.holdMode, 'sealed'); assert.ok(s.holdAlpha > 0);
    assert.deepEqual(s.holdPosition, { x: 195, y: 380 }, 'a later tap preserves the released charging ring at its original contact');
    await advance(2490); assert.equal((await snapshot()).state, 'WAITING', 'the latest release resets the inactivity deadline');
    await advance(20); s = await snapshot();
    assert.equal(s.state, 'GATHER'); assert.ok(s.orbs > 0); assert.ok(s.sourceStrokes > 0);
    for (const p of s.stars) assert.ok(s.sourceParticles.some(q => Math.hypot(p.x - q.x, p.y - q.y) < 20), 'tap stars supply particles to the shared explosion');
    await stable(1); await finish(); await retry();

    await down(100, 350); await advance(100); await cancel(); await advance(2000);
    s = await snapshot(); assert.equal(s.state, 'DRAWING'); assert.equal(s.stars.length, 0, 'OS cancellation cannot synthesize a tap');
    await down(180, 400); await advance(1000); await up();
    s = await snapshot(); assert.equal(s.stars.length, 0, 'a partial long press does not become a star');
    assert.equal(s.state, 'WAITING'); await advance(300);
    await down(170, 380); await advance(2950);
    assert.equal((await snapshot()).state, 'DRAWING');
    await advance(100); s = await snapshot();
    assert.equal(s.state, 'WAITING'); assert.equal(s.completionSource, 'autoHold'); assert.equal(s.pointerId, null);
    assert.equal(s.stars.length, 0, 'a completed hold cannot synthesize a tap');
    await advance(1700); assert.equal((await snapshot()).state, 'GATHER', 'holding continues into the explosion without a lift');
    await up(); await stable(2); await finish();

    await click('#formalReplay'); await click('#btnGoHome'); await click('#tab_effects');
    await page.locator('#effect_trailEnabled').evaluate(el => { el.closest('details').open = true; });
    await input('effect_trailOpacity', 10);
    await page.locator('#effect_trailEnabled').uncheck({ force: true });
    await click('#btnStart'); await advance(0);
    assert.deepEqual((await snapshot()).stars, []);
    await tap(220, 390); await advance(2500); s = await snapshot();
    assert.equal(s.state, 'GATHER'); assert.equal(s.stars.length, 1);
    assert.ok(s.orbs > 0, 'a single tap supplies a real explosion with the brush disabled');
    assert.equal(s.gatherOpacity, 1, 'brush opacity cannot dim the independent tap or hold explosion');
    assert.equal(s.sourceStrokes, 0); assert.ok(s.sourceParticles.length > 0);
    await stable(3);
    await finish(); await retry();
    await down(180, 400); await advance(800); await up();
    assert.equal((await snapshot()).holdMode, 'sealed', 'a visible partial charge stays available after release');
    await advance(2500); s = await snapshot();
    assert.equal(s.state, 'GATHER'); assert.equal(s.stars.length, 0);
    assert.ok(s.orbs > 0 && s.sourceParticles.length > 0, 'a partial hold supplies real energy after inactivity');
    assert.equal(s.gatherOpacity, 1);
    await stable(4);

    if (url.startsWith('http')) {
      await page.evaluate(() => navigator.serviceWorker.ready);
      await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), null, { polling: 50 });
      await context.setOffline(true);
      const offline = await context.newPage(); offline.on('pageerror', error => errors.push(String(error)));
      await offline.goto(url); await offline.reload();
      assert.equal(await offline.evaluate(() => typeof TapStars), 'function', 'the PWA caches the new tap renderer');
      assert.equal(await offline.locator('#appVersion').getAttribute('data-version'), await page.locator('#appVersion').getAttribute('data-version'));
    }
    assert.deepEqual(errors, []);
    console.log('PASS real taps/complete links/rendered pixels, resize, mixed brush/hold/stars, resumed inactivity, cancellation, automatic hold, disabled-brush tap explosion, immutable results, retry reset and optional offline cache.');
    console.log('Mixed interaction screenshot: ' + screenshot);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
