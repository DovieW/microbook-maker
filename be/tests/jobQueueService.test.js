const test = require('node:test');
const assert = require('node:assert/strict');

const { JobQueueService } = require('../services/jobQueueService');

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

test('JobQueueService enforces concurrency', async () => {
  const queue = new JobQueueService({ concurrency: 1 });
  const events = [];

  queue.enqueue('job-a', async () => {
    events.push('a-start');
    await delay(20);
    events.push('a-end');
  });

  queue.enqueue('job-b', async () => {
    events.push('b-start');
    await delay(1);
    events.push('b-end');
  });

  await queue.onIdle();

  assert.deepEqual(events, ['a-start', 'a-end', 'b-start', 'b-end']);
});

test('JobQueueService can remove queued jobs', async () => {
  const queue = new JobQueueService({ concurrency: 1 });
  const events = [];

  queue.enqueue('job-a', async () => {
    events.push('a-start');
    await delay(20);
    events.push('a-end');
  });

  queue.enqueue('job-b', async () => {
    events.push('b-start');
  });

  const removed = queue.remove('job-b');
  await queue.onIdle();

  assert.equal(removed, true);
  assert.deepEqual(events, ['a-start', 'a-end']);
  assert.equal(queue.isQueued('job-b'), false);
});
