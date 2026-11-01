/* The standby message is a device preference, independent of the drawn result. */
(function (root) {
  'use strict';

  const key = 'mana-cert-waiting-prompt-v1';
  const defaults = Object.freeze({
    text: '請按照你的方法觸碰儀器',
    size: 22,
    letterSpacing: 2,
    lineHeight: 1.5,
    color: '#ffffff'
  });

  function boundedNumber(value, fallback, min, max, precision = 1) {
    if (typeof value !== 'number' && !(typeof value === 'string' && value.trim())) return fallback;
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.round(Math.max(min, Math.min(max, number)) * precision) / precision;
  }

  function normalize(value) {
    const data = value && typeof value === 'object' ? value : {};
    return {
      text: typeof data.text === 'string' ? data.text.replace(/\r\n?/g, '\n') : defaults.text,
      size: boundedNumber(data.size, defaults.size, 12, 48),
      letterSpacing: boundedNumber(data.letterSpacing, defaults.letterSpacing, 0, 12),
      lineHeight: boundedNumber(data.lineHeight, defaults.lineHeight, .9, 2.4, 10),
      color: typeof data.color === 'string' && /^#[0-9a-f]{6}$/i.test(data.color) ? data.color.toLowerCase() : defaults.color
    };
  }

  function load(storage) {
    try {
      const saved = JSON.parse(storage.getItem(key));
      return normalize(saved?.version === 1 ? saved.values : null);
    } catch (_) {
      return normalize();
    }
  }

  function save(storage, values) {
    try {
      storage.setItem(key, JSON.stringify({version: 1, values: normalize(values)}));
      return true;
    } catch (_) {
      return false;
    }
  }

  function mount(doc, storage) {
    const settings = doc.getElementById('waitingPromptSettings');
    const copies = ['waitingPrompt', 'waitingPromptPreview'].map(id => doc.getElementById(id));
    const error = doc.getElementById('waitingPromptSaveError');
    let values = load(storage);

    function displayCopy() {
      for (const copy of copies) {
        copy.textContent = values.text;
        copy.style.setProperty('--prompt-size', values.size + 'px');
        copy.style.setProperty('--prompt-tracking', values.letterSpacing + 'px');
        copy.style.setProperty('--prompt-leading', String(values.lineHeight));
        copy.style.setProperty('--prompt-color', values.color);
      }
    }

    function displayValue(input) {
      const field = input.dataset.promptField;
      const output = doc.getElementById(input.id + 'Value');
      if (!output) return;
      if (field === 'color') output.textContent = values.color.toUpperCase();
      else if (field === 'lineHeight') output.textContent = values.lineHeight.toFixed(1) + ' 倍';
      else output.textContent = values[field] + ' px';
    }

    for (const input of settings.querySelectorAll('[data-prompt-field]')) {
      input.value = values[input.dataset.promptField];
      displayValue(input);
    }
    displayCopy();

    function onEdit(event) {
      const input = event.target;
      const field = input.dataset.promptField;
      if (!Object.hasOwn(defaults, field)) return;
      const next = normalize({...values, [field]: input.value});
      if (next[field] === values[field] && error.hidden) return;
      values = next;
      displayValue(input);
      displayCopy();
      error.hidden = save(storage, values);
    }

    // Native color pickers may emit only change. For controls emitting both,
    // the value comparison keeps a single save and preserves the editing caret.
    settings.addEventListener('input', onEdit);
    settings.addEventListener('change', onEdit);
    return {get values() { return {...values}; }};
  }

  root.WaitingPromptSettings = Object.freeze({key, defaults, normalize, load, save, mount});
})(globalThis);
