const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const listeners = new Map();
const moves = [];
let restores = 0;
const bubble = {
  addEventListener: (name, callback) => listeners.set(name, callback),
  setPointerCapture: () => {}
};
const html = fs.readFileSync(path.join(__dirname, '../src/renderer/compact.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
vm.runInNewContext(script, {
  document: { getElementById: () => bubble },
  window: {
    screenX: 100,
    screenY: 200,
    api: {
      onCompactWindowEnter: () => {},
      onCompactWindowReady: () => {},
      onCompactWindowLeave: () => {},
      moveCompactWindow: position => moves.push(position),
      restoreMainWindow: () => restores++
    }
  }
});

function emit(type, fields = {}) {
  listeners.get(type)({ type, button: 0, pointerId: 1, screenX: 120, screenY: 220, detail: 1, ...fields });
}

emit('pointerdown');
emit('pointermove', { screenX: 122 });
assert.equal(moves.length, 0);
emit('pointerup');
emit('click');
assert.equal(restores, 1);

emit('pointerdown');
emit('pointermove', { screenX: 150, screenY: 240 });
assert.equal(moves.at(-1).x, 130);
assert.equal(moves.at(-1).y, 220);
emit('pointermove', { screenX: 160, screenY: 245 });
assert.equal(moves.at(-1).x, 140);
assert.equal(moves.at(-1).y, 225);
emit('pointerup');
emit('click');
assert.equal(restores, 1);

emit('pointerdown');
emit('pointerup');
emit('click');
assert.equal(restores, 2);

emit('pointerdown');
emit('pointercancel');
emit('click');
assert.equal(restores, 2);
emit('click', { detail: 0 });
assert.equal(restores, 3);

const main = fs.readFileSync(path.join(__dirname, '../src/main/main.js'), 'utf8');
const handler = main.match(/ipcMain\.on\('move-compact-window',[\s\S]*?\n\}\);/)[0];
let moveWindow;
const sender = {};
const positions = [];
let warnings = 0;
const window = { isDestroyed: () => false, setPosition: (...position) => positions.push(position) };
vm.runInNewContext(handler, {
  ipcMain: { on: (name, callback) => { moveWindow = callback; } },
  compactWindow: window,
  BrowserWindow: { fromWebContents: source => source === sender ? window : null },
  console: { warn: () => warnings++ }
});
moveWindow({ sender }, { x: -30.5, y: 99.7 });
assert.deepEqual(positions, [[-30, 100]]);
moveWindow({ sender: {} }, { x: 0, y: 0 });
moveWindow({ sender }, { x: NaN, y: 0 });
assert.equal(positions.length, 1);
assert.equal(warnings, 1);

console.log('Compact window drag, click, cancellation and IPC checks passed.');
