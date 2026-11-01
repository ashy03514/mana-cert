'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.MANA_PLAYWRIGHT_MODULE || 'C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.MANA_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader']
  });
  try {
    const context = await browser.newContext({ viewport: { width: 435, height: 941 }, deviceScaleFactor: 2 });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    const url = process.env.MANA_TEST_URL || pathToFileURL(path.resolve(__dirname, '../index.html')).href;
    const prompt = page.locator('#waitingPrompt');
    const copy = page.locator('#waitingPromptText');
    const editor = page.locator('#waitingPromptSettings');
    const openEditor = async () => {
      if (!await editor.evaluate(el => el.open)) await editor.locator('summary').click();
    };
    const updateInput = async (id, value) => {
      await page.locator('#' + id).evaluate((el, value) => {
        el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }, value);
    };
    await page.goto(url);
    assert.equal(await prompt.isVisible(), false);
    await openEditor();
    assert.equal(await copy.inputValue(), '請按照你的方法觸碰儀器');

    const custom = '伸出手掌\n\n<b>光力</b>';
    await copy.fill(custom);
    await updateInput('waitingPromptSize', '25');
    await updateInput('waitingPromptLetterSpacing', '4');
    await updateInput('waitingPromptLineHeight', '1.8');
    await updateInput('waitingPromptColor', '#abc9ef');
    await page.reload();
    await openEditor();
    assert.equal(await copy.inputValue(), custom);
    await page.locator('#tab_probabilities').click();
    await updateInput('muggleChance', '100');
    await page.locator('#tab_effects').click();
    await page.locator('#effectPreview').click();
    assert.equal(await prompt.isVisible(), false, 'settings preview is separate from formal standby');
    await page.locator('#effectPreviewBack').click();

    await page.locator('#btnStart').click();
    await prompt.waitFor({ state: 'visible' });
    const presentation = await prompt.evaluate(el => {
      const css = getComputedStyle(el);
      const box = el.getBoundingClientRect();
      return { text: el.textContent, children: el.childElementCount, size: css.fontSize, spacing: css.letterSpacing,
        lineHeight: parseFloat(css.lineHeight), color: css.color, pointer: css.pointerEvents, y: box.y, height: box.height };
    });
    assert.equal(presentation.text, custom);
    assert.equal(presentation.children, 0, 'markup typed into the prompt stays literal text');
    assert.equal(presentation.size, '25px');
    assert.equal(presentation.spacing, '4px');
    assert.equal(presentation.lineHeight, 45);
    assert.equal(presentation.color, 'rgb(171, 201, 239)');
    assert.ok(presentation.height >= 3 * presentation.lineHeight, 'empty middle line occupies one full line');
    assert.ok(presentation.y > 0 && presentation.y + presentation.height < 941 / 2, 'copy sits above the drawing center');
    assert.equal(presentation.pointer, 'none');
    await page.mouse.click(218, presentation.y + 12, { button: 'right' });
    assert.equal(await prompt.isVisible(), true, 'ignored input must not dismiss the instructions');
    await page.mouse.move(218, presentation.y + 12);
    await page.mouse.down();
    assert.equal(await page.locator('body').getAttribute('data-state'), 'INTERACTION');
    assert.equal(await prompt.isVisible(), false, 'touching through the copy starts the actual drawing');
    await page.mouse.move(280, 360, { steps: 5 });
    await page.mouse.up();
    await page.locator('#formalReplay').waitFor({ state: 'visible', timeout: 60000 });
    assert.equal(await prompt.isVisible(), false);
    await page.locator('#formalReplay').click();
    await page.locator('#btnRetryCert').click();
    await prompt.waitFor({ state: 'visible' });
    assert.equal(await prompt.textContent(), custom, 'same instructions on the next instrument activation');
    await page.reload();
    await openEditor();
    await copy.fill('');
    await page.reload();
    await page.locator('#btnStart').click();
    assert.equal(await page.locator('body').getAttribute('data-state'), 'STANDBY');
    assert.equal(await prompt.isVisible(), false, 'saved blank copy disables the standby prompt');
    assert.deepEqual(errors, []);
    console.log('PASS formal standby prompt, multiline copy and styles after reload, safe literal markup, preview isolation, pointer pass-through, result/retry, and blank copy.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
