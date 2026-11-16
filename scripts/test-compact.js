const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');

const listeners = new Map();
const moves = [];
let restores = 0;
const classes = new Set();
let enterCompactWindow;
const bubble = {
  addEventListener: (name, callback) => listeners.set(name, callback),
  setPointerCapture: () => {}
};
const html = fs.readFileSync(path.join(__dirname, '../src/renderer/compact.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
vm.runInNewContext(script, {
  document: {
    getElementById: () => bubble,
    body: {
      classList: {
        add: (...names) => names.forEach(name => classes.add(name)),
        remove: (...names) => names.forEach(name => classes.delete(name))
      }
    }
  },
  window: {
    screenX: 100,
    screenY: 200,
    api: {
      onCompactWindowEnter: callback => { enterCompactWindow = callback; },
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

classes.add('leaving');
classes.add('interactive');
enterCompactWindow();
assert.equal(classes.has('leaving'), false);
assert.equal(classes.has('interactive'), false);
assert.equal(classes.has('entering'), true);
emit('click');
assert.equal(restores, 4);

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

async function testWindowReuse() {
  let created = 0;
  let loads = 0;
  let hidden = false;
  let bounds = { x: 100, y: 100, width: 520, height: 680 };
  const animations = [];
  class CompactWindow extends EventEmitter {
    constructor() {
      super();
      created++;
      this.webContents = { send: () => {} };
      this.bounds = { width: 72, height: 72, x: 0, y: 0 };
    }
    isDestroyed() { return false; }
    loadFile() {
      loads++;
      return Promise.resolve().then(() => this.emit('ready-to-show'));
    }
    setPosition(x, y) { Object.assign(this.bounds, { x, y }); }
    getBounds() { return this.bounds; }
    showInactive() { this.visible = true; }
    hide() { this.visible = false; }
  }
  const context = vm.createContext({
    BrowserWindow: CompactWindow,
    mainWindow: {
      isDestroyed: () => false,
      getBounds: () => bounds,
      getContentBounds: () => ({ ...bounds, y: bounds.y + 50 }),
      isMaximized: () => false,
      isFullScreen: () => false,
      hide: () => { hidden = true; },
      show: () => { hidden = false; },
      focus: () => {},
      setOpacity: () => {},
      setBounds: updated => { bounds = updated; }
    },
    compactWindow: null,
    compactWindowState: null,
    preloadedCompactWindow: null,
    compactWindowReady: null,
    opacityAnimationId: 0,
    animateWindowOpacity: (target, from, to, done) => animations.push(done),
    path,
    __dirname: path.join(__dirname, '../src/main'),
    console,
    screen: { getDisplayNearestPoint: () => ({ workArea: { x: 0, y: 0, width: 1920, height: 1080 } }) }
  });
  const lifecycle = main.slice(main.indexOf('function preloadCompactWindow()'), main.indexOf('// 弹窗管理'));
  vm.runInContext(lifecycle, context);
  const prepared = await context.preloadCompactWindow();
  const rect = { x: 430, y: 10, width: 24, height: 24 };
  assert.equal(await context.compactMainWindow(rect), true);
  assert.equal(created, 1);
  assert.equal(loads, 1);
  assert.equal(prepared.visible, true);
  animations.shift()();
  assert.equal(hidden, true);

  prepared.setPosition(prepared.bounds.x + 100, prepared.bounds.y + 20);
  context.restoreMainWindow();
  animations.shift()();
  assert.equal(hidden, false);
  assert.equal(prepared.visible, false);
  assert.equal(bounds.x, 200);
  assert.equal(bounds.y, 120);

  assert.equal(await context.compactMainWindow(rect), true);
  assert.equal(created, 1, 'Repeated collapse must reuse the preloaded window');
  assert.equal(loads, 1, 'Repeated collapse must not reload the page');
  animations.shift()();
  context.restoreMainWindow();
  animations.shift()();

  const pending = context.compactMainWindow(rect);
  context.restoreMainWindow();
  assert.equal(await pending, false);
  assert.equal(hidden, false);
  assert.equal(prepared.visible, false);
}

testWindowReuse().then(() => {
  console.log('Compact drag, click, IPC and preloaded-window reuse checks passed.');
}).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
