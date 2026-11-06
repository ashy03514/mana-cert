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
    const holdValues = {
      holdParticleCount: 80, holdParticleSize: 130, holdParticleBrightness: 75,
      holdInflowSpeed: 125, holdRingRadius: 85, holdTailLength: 155, holdTailWidth: 145,
      holdTailOpacity: 45, holdTailFalloff: 140
    };
    const holdColors = ['#ff5730', '#51c89e'];
    const click = selector => page.locator(selector).click({ force: true, noWaitAfter: true });
    const group = page.locator('details').filter({ has: page.locator('#effect_reset_hold') });
    const swatches = group.locator('#effect_holdPalette input[type=color]');
    const openHold = async () => {
      await click('#tab_effects');
      await group.locator('summary').click({ force: true, noWaitAfter: true });
      assert.ok(await group.evaluate(e => e.open));
    };
    const assertHoldControls = async () => {
      for (const [key, value] of Object.entries(holdValues)) {
        assert.equal(await group.locator('#effect_' + key).inputValue(), String(value), key);
      }
      assert.deepEqual(await swatches.evaluateAll(items => items.map(e => e.value)), holdColors);
    };
    await openHold();
    await input('effect_holdTailOpacity', 0);
    await click('#effect_reset_hold');
    assert.equal(await group.locator('#effect_holdTailOpacity').inputValue(), '20', 'factory group reset');
    for (const [key, value] of Object.entries(holdValues)) await input('effect_' + key, value);
    await group.locator('.effectSwatchRemove').last().click({ force: true, noWaitAfter: true });
    await swatches.evaluateAll((items, colors) => items.forEach((e, i) => {
      e.value = colors[i]; e.dispatchEvent(new Event('input', { bubbles: true }));
    }), holdColors);
    await assertHoldControls();
    await click('#effectSetDefault');
    await input('effect_holdParticleCount', 16);
    await click('#effect_reset_hold');
    await assertHoldControls();
    await input('effect_holdRingRadius', 160);
    await click('#effectResetAll');
    await assertHoldControls();
    await page.reload();
    await openHold();
    await assertHoldControls();

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
      const holdStep = observed.stepReference = HoldMagic.prototype.step;
      HoldMagic.prototype.step = function (...args) { observed.field = this; return holdStep.apply(this, args); };
      const down = PortalScene.prototype.down;
      PortalScene.prototype.down = function (...args) { observed.scene = this; return down.apply(this, args); };
    });
    const snapshot = () => page.evaluate(() => {
      const s = window.holdObserved;
      return {
        state: s.flow?.state, elapsed: s.flow?.elapsed, hold: s.flow?.holdFrame,
        tapCount: s.flow?.tapCount, committed: s.flow?.committed,
        field: s.field && { x: s.field.x, y: s.field.y, mode: s.field.mode, alpha: s.field.alpha },
        completionSource: s.flow?.completionSource, begins: s.begins, result: s.result,
        same: s.result === s.session?.currentResult,
        unchanged: s.json === JSON.stringify(s.session?.currentResult),
        frozen: Object.isFrozen(s.session?.currentResult),
        orbCount: s.gather?.orbs?.length, releasePoint: s.flow?.releasePoint,
        pointerId: s.scene?.pointer.id,
        orbs: s.gather?.orbs.map(p => [p.x * s.gather.width, p.y * s.gather.height]),
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
    const press = { x: 132, y: 280 };
    const recordField = async name => {
      await page.screenshot({ path: path.join(os.tmpdir(), 'mana-infall-' + name + '.png') });
      return page.evaluate(({ x, y }) => {
        const field = window.holdObserved.field;
        const canvas = document.createElement('canvas');
        canvas.width = field.width;
        canvas.height = field.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        field.draw(ctx);
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let outer = 0, ring = 0;
        for (let py = 0; py < canvas.height; py += 2) for (let px = 0; px < canvas.width; px += 2) {
          const alpha = data[4 * (py * canvas.width + px) + 3];
          if (alpha < 8) continue;
          const distance = Math.hypot(px - x, py - y);
          if (distance > 150) outer += alpha;
          if (distance >= 15 && distance <= 85) ring += alpha;
        }
        return { outer, ring };
      }, press);
    };

    // Compare the actual field's pixels to an explicitly configured renderer at
    // the same touch and age. Run this through both normal entry points.
    const assertHoldRendering = async mode => {
      const report = await page.evaluate(settings => {
        const field = window.holdObserved.field;
        const reference = new HoldMagic(undefined, settings);
        reference.resize(field.width, field.height);
        window.holdObserved.stepReference.call(reference, 0, { x: field.x, y: field.y, age: field.age });
        const pixels = renderer => {
          const c = document.createElement('canvas');
          c.width = field.width; c.height = field.height;
          const ctx = c.getContext('2d');
          renderer.draw(ctx);
          return ctx.getImageData(0, 0, c.width, c.height).data;
        };
        const actual = pixels(field), expected = pixels(reference);
        return {
          count: field.grains.length, colors: [...new Set(field.captureTrails().holdParticles.map(p => p.color))].sort(),
          matches: actual.every((v, i) => v === expected[i]), visible: actual.some((v, i) => i % 4 === 3 && v > 25)
        };
      }, { ...holdValues, holdPalette: holdColors });
      assert.equal(report.count, holdValues.holdParticleCount, mode);
      assert.deepEqual(report.colors, [...holdColors].sort(), mode);
      assert.ok(report.matches && report.visible, mode + ' renders the configured hold effect');
    };
    await group.locator('[data-flow-preview]').click({ force: true, noWaitAfter: true });
    assert.equal(await page.locator('body').getAttribute('data-state'), 'FLOW_PREVIEW');
    await advance(0);
    await startTouch(press.x, press.y);
    await advance(750);
    await assertHoldRendering('hold preview');
    await cancelTouch();
    await click('#effectPreviewBack');
    assert.ok(await group.locator('[data-flow-preview]').evaluate(e => document.activeElement === e));
    await click('#tab_switches');

    // Force a basic magic outcome through the public settings so result wiring is exercised.
    await page.locator('#s_muggle').uncheck({ force: true });
    for (const name of ['water', 'wind', 'earth', 'light', 'dark', 'lightning']) await page.locator('#s_' + name).uncheck({ force: true });
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
    await advance(1000);
    assert.equal((await snapshot()).state, 'WAITING', 'a partial hold begins a resumable quiet period');
    assert.equal((await snapshot()).completionSource, 'release');
    assert.equal((await snapshot()).tapCount, 0, 'a partial hold does not manufacture a tap star');

    await startTouch(press.x, press.y);
    await advance(750);
    await assertHoldRendering('formal appraisal');
    const early = await recordField('early');
    await advance(800);
    const mid = await recordField('mid');
    assert.equal((await snapshot()).hold.ready, true, 'release is available before automatic completion');
    await advance(650);
    await recordField('late');
    await advance(750);
    const peak = await recordField('peak');
    assert.ok(early.outer + mid.outer > 0, 'incoming magic is visible well outside the original small touch field');
    assert.ok(peak.ring > early.ring, 'the fingertip annulus accumulates visible magic');
    assert.equal((await snapshot()).state, 'DRAWING', 'a steady press still charges at 2.95 seconds');
    await advance(100);
    let s = await snapshot();
    assert.equal(s.state, 'WAITING', 'holding for three seconds starts the two inward waves before lifting');
    assert.equal(s.pointerId, null, 'the committed touch no longer owns input');
    assert.equal(s.releasePoint.x, press.x);
    assert.equal(s.releasePoint.y, press.y);
    await moveTouch(200, 340);
    await advance(1700);
    s = await snapshot();
    assert.equal(s.state, 'GATHER', 'the explosion proceeds while the finger remains down');
    assert.ok(s.orbCount >= 32, 'the assembled ring supplies a full cloud of release particles');
    const aroundTouch = s.orbs.filter(([x, y]) => Math.hypot(x - press.x, y - press.y) < 95);
    assert.ok(aroundTouch.length >= s.orbs.length * .75, 'the gathered orbs originate near the actual off-center press');
    await endTouch();
    const afterLift = await snapshot();
    assert.equal(afterLift.state, 'GATHER');
    assert.equal(afterLift.elapsed, s.elapsed, 'a late finger lift neither restarts nor delays the explosion');
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
    await advance(1000);
    assert.equal((await snapshot()).state, 'WAITING', 'a fresh short touch adds a star and waits for more input');
    assert.equal((await snapshot()).tapCount, 1, 'the cancelled hold contributes no tap');
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

    await page.mouse.move(130, 420);
    await page.mouse.down();
    await page.mouse.move(225, 340, { steps: 5 });
    await page.mouse.move(270, 460, { steps: 5 });
    await page.mouse.up();
    assert.equal((await snapshot()).state, 'WAITING', 'direct drawing is still supported');
    await advance(12000);
    await assertStable(2);
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
    assert.equal((await snapshot()).state, 'WAITING', 'a voluntary release begins the same quiet period as ink or taps');
    assert.equal((await snapshot()).committed, false, 'early release remains resumable');
    await advance(600);
    assert.equal((await snapshot()).state, 'WAITING');
    assert.equal((await snapshot()).field.x, 30, 'the released ring stays at its contact point while waiting');
    assert.equal((await snapshot()).field.mode, 'sealed');
    await startTouch(65, 450);
    assert.equal((await snapshot()).state, 'DRAWING', 'another press resumes a released hold');
    await advance(1300);
    await endTouch();
    assert.equal((await snapshot()).releasePoint.x, 65);
    assert.equal((await snapshot()).state, 'WAITING');
    await advance(1690);
    assert.equal((await snapshot()).state, 'WAITING', 'resuming creates a full new quiet period');
    await advance(10);
    s = await snapshot();
    assert.equal(s.state, 'GATHER');
    assert.ok(s.orbCount >= 32, 'turning the ribbon off still allows long-press magic to be released');
    await assertStable(3);
    console.log('PASS configured hold preview/formal pixels, preset, reset and reload; visible wide-field infall and growing ring, automatic off-center appraisal without lifting, resumable early release, tap and partial-hold timing, immutable result, cancellation, background time, drawing and offline disabled-ribbon flow.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
