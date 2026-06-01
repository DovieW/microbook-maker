const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildStaleJobProgress,
  createQueuedProgress,
  resolveJobState,
} = require('../services/jobStateService');

test('buildStaleJobProgress describes orphaned metadata-only jobs', () => {
  const progress = buildStaleJobProgress({
    bookName: 'Ghost Book',
    createdAt: '2026-05-31T00:00:00.000Z',
  }, {
    now: new Date('2026-05-31T00:05:00.000Z').getTime(),
  });

  assert.equal(progress.isError, true);
  assert.equal(progress.phase, 'stale_job');
  assert.match(progress.errorMessage, /Stale job record for Ghost Book/i);
});

test('resolveJobState keeps genuinely queued jobs queued', () => {
  const state = resolveJobState({
    metadata: { bookName: 'Queued Book' },
    runningStatus: 'queued',
    isQueued: true,
  });

  assert.equal(state.status, 'queued');
  assert.deepEqual(state.progress, createQueuedProgress());
});

test('resolveJobState marks metadata-only orphans as error instead of queued', () => {
  const state = resolveJobState({
    metadata: {
      bookName: 'Ghost Book',
      createdAt: '2026-05-31T00:00:00.000Z',
    },
    now: new Date('2026-05-31T00:05:00.000Z').getTime(),
  });

  assert.equal(state.status, 'error');
  assert.equal(state.progress.isError, true);
  assert.match(state.progress.errorMessage, /Delete this record and run the job again/i);
});
