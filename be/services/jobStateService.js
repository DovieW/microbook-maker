const DEFAULT_STALE_PHASE = 'stale_job';

function createQueuedProgress(step = 'Queued') {
  return {
    step,
    percentage: 0,
    isComplete: false,
    isError: false,
    phase: 'queued',
  };
}

function createProcessingProgress(step = 'Processing', percentage = 1) {
  return {
    step,
    percentage,
    isComplete: false,
    isError: false,
    phase: 'processing',
  };
}

function createCompletedProgress() {
  return {
    step: 'Complete',
    percentage: 100,
    isComplete: true,
    isError: false,
    phase: 'complete',
  };
}

function createErrorProgress(errorMessage, phase = 'error') {
  return {
    step: 'Error',
    percentage: 0,
    isComplete: false,
    isError: true,
    errorMessage,
    phase,
  };
}

function getDisplayName(metadata = {}) {
  return metadata.bookName || metadata.originalFileName || 'this job';
}

function parseCreatedAt(createdAt) {
  if (!createdAt) {
    return null;
  }

  const timestamp = new Date(createdAt).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function buildStaleJobProgress(metadata = {}, { now = Date.now() } = {}) {
  const createdAtTimestamp = parseCreatedAt(metadata.createdAt);
  const ageMinutes = createdAtTimestamp === null
    ? null
    : Math.max(0, Math.round((now - createdAtTimestamp) / 60000));
  const displayName = getDisplayName(metadata);
  const ageMessage = ageMinutes === null
    ? 'It no longer has an active queue entry, progress file, or completed output.'
    : `It has been inactive for about ${ageMinutes} minute${ageMinutes === 1 ? '' : 's'} and no longer has an active queue entry, progress file, or completed output.`;

  return createErrorProgress(
    `Stale job record for ${displayName}. ${ageMessage} Delete this record and run the job again.`,
    DEFAULT_STALE_PHASE,
  );
}

function resolveJobState({
  metadata = {},
  pdfExists = false,
  completedAt = null,
  structuredProgress = null,
  legacyProgress = null,
  runningStatus = null,
  isQueued = false,
  now = Date.now(),
} = {}) {
  if (pdfExists) {
    return {
      status: 'completed',
      progress: createCompletedProgress(),
      completedAt,
    };
  }

  if (structuredProgress) {
    return {
      status: structuredProgress.isError
        ? 'error'
        : (structuredProgress.isComplete ? 'completed' : 'in_progress'),
      progress: structuredProgress,
      completedAt,
    };
  }

  if (legacyProgress) {
    return {
      status: legacyProgress.isError ? 'error' : 'in_progress',
      progress: legacyProgress,
      completedAt,
    };
  }

  if (runningStatus === 'running') {
    return {
      status: 'in_progress',
      progress: createProcessingProgress(),
      completedAt,
    };
  }

  if (runningStatus === 'queued' || isQueued) {
    return {
      status: 'queued',
      progress: createQueuedProgress(),
      completedAt,
    };
  }

  return {
    status: 'error',
    progress: buildStaleJobProgress(metadata, { now }),
    completedAt,
  };
}

module.exports = {
  buildStaleJobProgress,
  createCompletedProgress,
  createErrorProgress,
  createProcessingProgress,
  createQueuedProgress,
  resolveJobState,
};
