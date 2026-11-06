const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const context = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/rank-message.js'), 'utf8'), context);
const R = context.RankMessage;
const plain = value => JSON.parse(JSON.stringify(value));
const ranks = ['E', 'D', 'C', 'B', 'A', 'S', 'SS'];
const key = 'mana-cert-rank-message-v1';
const expected = {
  enabled: true, size: 16,
  messages: {
    E: '魔力初醒，旅程正要展開', D: '魔力流動，回應你的呼喚',
    C: '力量成形，可能正在展開', B: '意志匯聚，魔力愈發堅定',
    A: '強大的魔力，已與你共鳴', S: '非凡之力，於此刻甦醒',
    SS: '傳說覺醒，世界為你共鳴'
  }
};

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {data, writes: 0, fail: false,
    getItem(name) { if (this.fail) throw new Error('Storage denied'); return data.get(name) ?? null; },
    setItem(name, value) { if (this.fail) throw new Error('Storage denied'); data.set(name, value); this.writes++; }
  };
}

assert.deepEqual(plain(R.defaults), expected);
assert.ok(Object.isFrozen(R.defaults) && Object.isFrozen(R.defaults.messages));
for (const invalid of [undefined, null, false, 3, 'text', [], {size: null, enabled: 'false'}]) {
  assert.deepEqual(plain(R.normalize(invalid)), expected);
}
const normalized = R.normalize({enabled: false, size: '21.7', messages: {E: '  第一行\r\n第二行\n第三行  ', D: ' \t\n ', C: '🌟'.repeat(41), B: false}});
assert.equal(normalized.enabled, false);
assert.equal(normalized.size, 22);
assert.equal(normalized.messages.E, '第一行 第二行 第三行');
assert.equal(normalized.messages.D, '');
assert.equal(normalized.messages.C, '🌟'.repeat(40), 'Truncate complete Unicode code points');
assert.equal(normalized.messages.B, expected.messages.B);
for (const [input, size] of [[-1, 12], [99, 22], [16.4, 16], [NaN, 16], [Infinity, 16], [' ', 16], [true, 16], [{}, 16]]) {
  assert.equal(R.normalize({size: input}).size, size);
}
assert.equal(R.normalize({messages:{E:'一\u2028二\u2029三\r四'}}).messages.E, '一 二 三 四');
assert.deepEqual(plain(R.normalize(Object.create({enabled: false, size: 22, messages: {E: 'inherited'}}))), expected);
assert.deepEqual(plain(R.normalize({messages: Object.create({E: 'inherited'})})), expected);
const polluted = JSON.parse('{"__proto__":{"enabled":false},"messages":{"__proto__":{"E":"bad"},"constructor":"bad","SS":"合法"}}');
assert.deepEqual(Object.keys(R.normalize(polluted).messages), ranks);
assert.equal(R.normalize(polluted).messages.E, expected.messages.E);
assert.equal(R.normalize(polluted).messages.SS, '合法');
const first = R.normalize();
first.messages.E = 'changed';
assert.equal(R.normalize().messages.E, expected.messages.E);

const storage = memoryStorage({'mana-cert-settings-v1': 'certification settings', 'mana-cert-waiting-prompt-v1': 'standby settings'});
assert.deepEqual(plain(R.load(storage)), expected);
assert.equal(R.save(storage, normalized), true);
assert.equal(storage.writes, 1);
assert.deepEqual(plain(R.load(storage)), plain(normalized));
assert.equal(JSON.parse(storage.data.get(key)).version, 1);
assert.equal(storage.data.get('mana-cert-settings-v1'), 'certification settings');
assert.equal(storage.data.get('mana-cert-waiting-prompt-v1'), 'standby settings');
for (const broken of ['{', 'null', '[]', '{"version":2,"values":{"enabled":false}}', '{"version":1,"values":false}']) {
  assert.deepEqual(plain(R.load(memoryStorage({[key]: broken}))), expected);
}
storage.fail = true;
assert.deepEqual(plain(R.load(storage)), expected);
assert.equal(R.save(storage, expected), false);
assert.deepEqual(plain(R.load(undefined)), expected);
assert.equal(R.save(undefined, expected), false);

// Minimal DOM keeps focus/caret and persistence behavior observable without dependencies.
class Element {
  constructor(tagName, id = '') {
    this.tagName = tagName.toUpperCase(); this.id = id; this.dataset = {};
    this.children = []; this.listeners = {}; this.value = ''; this.hidden = true;
  }
  append(...children) { for (const child of children) { child.parentNode = this; this.children.push(child); } }
  replaceChildren(...children) { this.children = []; this.append(...children); }
  addEventListener(type, listener) { (this.listeners[type] ||= []).push(listener); }
  fire(type) {
    const event = {target: this};
    for (let element = this; element; element = element.parentNode) {
      for (const listener of element.listeners[type] || []) listener(event);
    }
  }
}
function documentStub() {
  const elements = ['rankMessageFields', 'rankMessageEnabled', 'rankMessageSize', 'rankMessageSizeValue', 'rankMessageSaveError']
    .map(id => new Element('div', id));
  const find = (items, id) => {
    for (const element of items) { if (element.id === id) return element; const nested = find(element.children, id); if (nested) return nested; }
  };
  return {getElementById(id) { return find(elements, id); }, createElement(tag) { return new Element(tag); }};
}
const doc = documentStub();
const mountedStorage = memoryStorage();
const view = R.mount(doc, mountedStorage);
assert.deepEqual(plain(view.values), expected);
assert.equal(mountedStorage.writes, 0, 'Mount does not save or overwrite preferences');
assert.equal(doc.getElementById('rankMessageFields').children.length, 7);
for (const rank of ranks) {
  const input = doc.getElementById('rankMessage_' + rank);
  assert.equal(input.value, expected.messages[rank]);
  assert.equal(input.type, 'text');
  assert.equal(input.maxLength, 40);
  assert.equal(input.parentNode.children[0].htmlFor, input.id);
}
const e = doc.getElementById('rankMessage_E');
e.value = '  自訂魔力  '; e.selectionStart = 5; e.selectionEnd = 5;
e.fire('input'); e.fire('change');
assert.equal(mountedStorage.writes, 1, 'Input/change pair saves once');
assert.equal(view.values.messages.E, '自訂魔力');
assert.equal(e.value, '  自訂魔力  ', 'Do not rewrite the active edit');
assert.equal(e.selectionStart, 5); assert.equal(e.selectionEnd, 5);
const copy = view.values; copy.enabled = false; copy.messages.E = 'unexpected mutation';
assert.equal(view.values.enabled, true); assert.equal(view.values.messages.E, '自訂魔力');
const size = doc.getElementById('rankMessageSize'); size.value = '20'; size.fire('input');
assert.equal(view.values.size, 20);
assert.equal(doc.getElementById('rankMessageSizeValue').textContent, '20 px');
const enabled = doc.getElementById('rankMessageEnabled'); enabled.checked = false; enabled.fire('change');
assert.equal(view.values.enabled, false);
assert.equal(doc.getElementById('rankMessageSaveError').hidden, true);
mountedStorage.fail = true;
e.value = '仍可使用'; e.fire('input');
assert.equal(view.values.messages.E, '仍可使用');
assert.equal(doc.getElementById('rankMessageSaveError').hidden, false);
mountedStorage.fail = false;
e.fire('change');
assert.equal(doc.getElementById('rankMessageSaveError').hidden, true);
assert.equal(R.load(mountedStorage).messages.E, '仍可使用');
assert.deepEqual(plain(R.mount(documentStub(), mountedStorage).values), plain(view.values));
assert.deepEqual(plain(R.mount(documentStub(), undefined).values), expected);

for (const rank of ranks) {
  const result = Object.freeze({type: 'magic', rank, mana: 1, element: '火'});
  for (const time of [-10, 0, 4, 4.29, 4.3]) {
    const frame = R.frame(expected, result, time, 4);
    assert.equal(frame.text, expected.messages[rank], 'Use final rank even before reveal');
    assert.ok(frame.opacity < 1e-12, 'Hidden until 300 ms after completion');
  }
  assert.ok(Math.abs(R.frame(expected, result, 4.4, 4).opacity - .15625) < 1e-10);
  assert.ok(Math.abs(R.frame(expected, result, 4.5, 4).opacity - .5) < 1e-10);
  assert.ok(Math.abs(R.frame(expected, result, 4.6, 4).opacity - .84375) < 1e-10);
  assert.equal(R.frame(expected, result, 4.7, 4).opacity, 1);
  assert.equal(R.frame(expected, result, 100, 4).opacity, 1);
  assert.equal(result.rank, rank);
}
for (const result of [null, {}, {type: 'muggle', rank: 'E'}, {type: 'muggle', rank: 'MUGGLE'},
  {type: 'magic', rank: 'MUGGLE'}, {type: 'magic', rank: '__proto__'}, {type: 'magic', rank: 'constructor'}, {type: 'other', rank: 'A'}]) {
  assert.deepEqual(plain(R.frame(expected, result, 10, 1)), {text: '', opacity: 0});
}
const magic = {type: 'magic', rank: 'E'};
assert.deepEqual(plain(R.frame({...expected, enabled: false}, magic, 10, 1)), {text: '', opacity: 0});
assert.deepEqual(plain(R.frame({...expected, messages:{E:' '}}, magic, 10, 1)), {text: '', opacity: 0});
for (const times of [[undefined, 4], [5, undefined], [NaN, 4], [5, Infinity]]) {
  assert.deepEqual(plain(R.frame(expected, magic, ...times)), {text: expected.messages.E, opacity: 0});
}
console.log('Rank message settings, persistence, editing, and seven-rank reveal timing passed.');
