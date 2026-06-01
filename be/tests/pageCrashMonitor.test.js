const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');

const {
  createPageCrashMonitor,
  normalizePageCrashError,
} = require('../utils/pageCrashMonitor');

test('normalizePageCrashError keeps the crash message and adds renderer guidance', () => {
  const error = normalizePageCrashError(new Error('Page crashed!'));

  assert.match(error.message, /^Page crashed!/i);
  assert.match(error.message, /shared memory|memory/i);
});

test('createPageCrashMonitor rejects pending work when the page crashes', async () => {
  const page = new EventEmitter();
  const crashMessages = [];
  const monitor = createPageCrashMonitor({
    page,
    onCrash: (error) => {
      crashMessages.push(error.message);
    },
  });

  const pendingWork = monitor.race(new Promise(() => {}));
  page.emit('error', new Error('Page crashed!'));

  await assert.rejects(pendingWork, /Page crashed!/i);
  assert.equal(monitor.hasCrashed(), true);
  assert.equal(crashMessages.length, 1);

  await assert.rejects(monitor.race(Promise.resolve('ok')), /Page crashed!/i);
  monitor.dispose();
});

test('createPageCrashMonitor only records the first crash', () => {
  const page = new EventEmitter();
  const crashMessages = [];
  const monitor = createPageCrashMonitor({
    page,
    onCrash: (error) => {
      crashMessages.push(error.message);
    },
  });

  page.emit('error', new Error('Page crashed!'));
  page.emit('error', new Error('Page crashed again!'));

  assert.equal(crashMessages.length, 1);
  assert.match(monitor.getError().message, /Page crashed!/i);
  monitor.dispose();
});
