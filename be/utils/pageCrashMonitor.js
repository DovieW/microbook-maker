function normalizePageCrashError(error) {
  const rawMessage = error instanceof Error
    ? error.message
    : String(error || 'Page crashed!');

  if (/page crashed!?/i.test(rawMessage)) {
    // Keep the original message prefix so existing UI/debugging still clearly shows
    // that Chromium crashed, while adding the Docker memory hint we learned from prod.
    return new Error(
      'Page crashed! Chromium renderer likely ran out of memory or shared memory while laying out the document.',
      error instanceof Error ? { cause: error } : undefined,
    );
  }

  return error instanceof Error ? error : new Error(rawMessage);
}

function createPageCrashMonitor({ page, onCrash = null } = {}) {
  if (!page || typeof page.on !== 'function' || typeof page.off !== 'function') {
    throw new TypeError('createPageCrashMonitor requires a Puppeteer page-like object with on/off methods.');
  }

  let crashError = null;
  let rejectCrashPromise = null;

  const crashPromise = new Promise((resolve, reject) => {
    rejectCrashPromise = reject;
  });

  // This promise is intentionally reused across many awaited page operations. Attach a
  // noop catch once so an early crash does not become an unhandled rejection before the
  // next Promise.race consumer attaches.
  crashPromise.catch(() => {});

  const markCrashed = (error) => {
    if (crashError) {
      return crashError;
    }

    crashError = normalizePageCrashError(error);
    if (typeof onCrash === 'function') {
      onCrash(crashError);
    }
    rejectCrashPromise(crashError);
    return crashError;
  };

  const handlePageError = (error) => {
    markCrashed(error);
  };

  page.on('error', handlePageError);

  return {
    race(operation) {
      if (crashError) {
        return Promise.reject(crashError);
      }

      return Promise.race([
        Promise.resolve().then(() => {
          if (crashError) {
            throw crashError;
          }

          return typeof operation === 'function' ? operation() : operation;
        }),
        crashPromise,
      ]);
    },
    hasCrashed() {
      return Boolean(crashError);
    },
    getError() {
      return crashError;
    },
    dispose() {
      page.off('error', handlePageError);
    },
  };
}

module.exports = {
  createPageCrashMonitor,
  normalizePageCrashError,
};
