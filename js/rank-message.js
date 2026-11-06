/* Final-rank copy is a device preference. It never selects or changes a result. */
(function (root) {
  'use strict';

  const key = 'mana-cert-rank-message-v1';
  const ranks = ['E', 'D', 'C', 'B', 'A', 'S', 'SS'];
  const defaults = Object.freeze({
    enabled: true,
    size: 16,
    messages: Object.freeze({
      E: '魔力初醒，旅程正要展開',
      D: '魔力流動，回應你的呼喚',
      C: '力量成形，可能正在展開',
      B: '意志匯聚，魔力愈發堅定',
      A: '強大的魔力，已與你共鳴',
      S: '非凡之力，於此刻甦醒',
      SS: '傳說覺醒，世界為你共鳴'
    })
  });

  function own(value, name) {
    return value && typeof value === 'object' && !Array.isArray(value) &&
      Object.prototype.hasOwnProperty.call(value, name) ? value[name] : undefined;
  }

  function normalize(value) {
    const enabled = own(value, 'enabled');
    const rawSize = own(value, 'size');
    const size = typeof rawSize === 'number' || (typeof rawSize === 'string' && rawSize.trim())
      ? Number(rawSize) : NaN;
    const messages = own(value, 'messages');
    return {
      enabled: typeof enabled === 'boolean' ? enabled : defaults.enabled,
      size: Number.isFinite(size) ? Math.round(Math.max(12, Math.min(22, size))) : defaults.size,
      messages: Object.fromEntries(ranks.map(rank => {
        const text = own(messages, rank);
        return [rank, typeof text === 'string'
          ? Array.from(text.replace(/\r\n?|\n|\u2028|\u2029/g, ' ').trim()).slice(0, 40).join('')
          : defaults.messages[rank]];
      }))
    };
  }

  function load(storage) {
    try {
      const saved = JSON.parse(storage.getItem(key));
      return normalize(own(saved, 'version') === 1 ? own(saved, 'values') : null);
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
    const fields = doc.getElementById('rankMessageFields');
    const enabled = doc.getElementById('rankMessageEnabled');
    const size = doc.getElementById('rankMessageSize');
    const sizeValue = doc.getElementById('rankMessageSizeValue');
    const error = doc.getElementById('rankMessageSaveError');
    let values = load(storage);

    fields.replaceChildren();
    for (const rank of ranks) {
      const row = doc.createElement('div');
      row.className = 'rankMessageField';
      const label = doc.createElement('label');
      label.htmlFor = 'rankMessage_' + rank;
      label.textContent = rank + ' 階級';
      const input = doc.createElement('input');
      input.type = 'text';
      input.id = label.htmlFor;
      input.dataset.rankMessageRank = rank;
      input.maxLength = 40;
      input.autocomplete = 'off';
      input.value = values.messages[rank];
      row.append(label, input);
      fields.append(row);
    }
    enabled.checked = values.enabled;
    size.min = '12';
    size.max = '22';
    size.step = '1';
    size.value = values.size;
    sizeValue.textContent = values.size + ' px';
    error.hidden = true;

    function onEdit(event) {
      const input = event.target;
      let next;
      if (input === enabled) next = normalize({...values, enabled: enabled.checked});
      else if (input === size) next = normalize({...values, size: size.value});
      else {
        const rank = input.dataset?.rankMessageRank;
        if (!ranks.includes(rank)) return;
        next = normalize({...values, messages: {...values.messages, [rank]: input.value}});
      }
      const changed = next.enabled !== values.enabled || next.size !== values.size ||
        ranks.some(rank => next.messages[rank] !== values.messages[rank]);
      if (!changed && error.hidden) return;
      values = next;
      sizeValue.textContent = values.size + ' px';
      // Persist normalized copy without rewriting the active text input or its caret.
      // A repeated change event also retries a previous storage failure.
      error.hidden = save(storage, values);
    }

    for (const control of [fields, enabled, size]) {
      control.addEventListener('input', onEdit);
      control.addEventListener('change', onEdit);
    }
    return {get values() { return {...values, messages: {...values.messages}}; }};
  }

  function frame(settings, result, elapsed, completeAt) {
    if (own(result, 'type') !== 'magic' || !ranks.includes(own(result, 'rank'))) {
      return {text: '', opacity: 0};
    }
    const values = normalize(settings);
    const text = values.enabled ? values.messages[result.rank] : '';
    // Keep the final copy available for layout before it becomes visible.
    if (!text || !Number.isFinite(elapsed) || !Number.isFinite(completeAt)) return {text, opacity: 0};
    const progress = Math.max(0, Math.min(1, (elapsed - completeAt - .3) / .4));
    return {text, opacity: progress * progress * (3 - 2 * progress)};
  }

  root.RankMessage = Object.freeze({defaults, normalize, load, save, mount, frame});
})(globalThis);
