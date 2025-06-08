import { useState, useCallback, useEffect, useRef } from 'react';
import { Job, UseJobManagementReturn } from '../types';
import { JobManagementService } from '../services/jobManagementService';
import { PdfGeneratorService } from '../services/pdfGeneratorService';
import { ApiError } from '../services/errors';

/**
 * Custom hook for managing PDF generation jobs
 * Provides job listing, real-time updates, and job actions
 */
export function useJobManagement(): UseJobManagementReturn {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const initialLoadRef = useRef<boolean>(false);
  const scrollToTopCallbackRef = useRef<(() => void) | null>(null);

  const addNewJob = useCallback((jobId: string, bookName: string, fontSize: string, originalFileName?: string, borderStyle?: string, author?: string, year?: string, series?: string) => {
    // Extract timestamp from jobId to construct uploadPath
    const jobParts = jobId.split('_');
    const timestamp = jobParts[0]; // YYYYMMDDHHMMSS
    const uploadPath = originalFileName ? `${timestamp}_${originalFileName}` : null;

    const newJob: Job = {
      id: jobId,
      bookName,
      fontSize,
      borderStyle: borderStyle || null,
      author: author || null,
      year: year || null,
      series: series || null,
      status: 'queued',
      progress: { percentage: 0, step: 'Starting generation...', isComplete: false, isError: false },
      createdAt: new Date().toISOString(),
      completedAt: null,
      originalFileName: originalFileName || null,
      uploadPath: uploadPath,
    };

    setJobs(prevJobs => [newJob, ...prevJobs]);

    // Trigger scroll to top when a new job is added
    if (scrollToTopCallbackRef.current) {
      scrollToTopCallbackRef.current();
    }
  }, []);

  const refreshJobs = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await JobManagementService.fetchJobs();
      setJobs(response.jobs);
      setLoading(false);
    } catch (err) {
      const error = err instanceof ApiError ? err : new ApiError(
        `Unexpected error: ${err instanceof Error ? err.message : 'Unknown error'}`,
        0,
        'UNKNOWN_ERROR'
      );
      setError(error);
      setLoading(false);
      console.error('Failed to fetch jobs:', error);
    }
  }, []);

  const updateJobProgress = useCallback(async (jobId: string) => {
    try {
      const progressResponse = await PdfGeneratorService.checkProgress(jobId);

      setJobs(prevJobs =>
        prevJobs.map(job => {
          if (job.id === jobId) {
            let newStatus = job.status;
            let completedAt = job.completedAt;

            if (progressResponse.status === 'completed') {
              newStatus = 'completed';
              completedAt = completedAt || new Date().toISOString();
            } else if (progressResponse.status === 'error') {
              newStatus = 'error';
            } else if (progressResponse.status === 'in_progress') {
              newStatus = 'in_progress';
            }

            return {
              ...job,
              status: newStatus,
              progress: progressResponse.progress || job.progress,
              completedAt
            };
          }
          return job;
        })
      );
    } catch (err) {
      console.error(`Failed to update progress for job ${jobId}:`, err);
    }
  }, []);

  const startPolling = useCallback(() => {
    if (intervalRef.current) return; // Already polling

    intervalRef.current = setInterval(() => {
      // Get current jobs from state to avoid stale closure
      setJobs(currentJobs => {
        const inProgressJobs = currentJobs.filter(job =>
          job.status === 'in_progress' || job.status === 'queued'
        );

        inProgressJobs.forEach(job => {
          updateJobProgress(job.id);
        });

        return currentJobs; // Return unchanged jobs
      });

      // Refresh job list periodically to catch new jobs
      if (Math.random() < 0.1) { // 10% chance each interval (every ~20 seconds on average)
        refreshJobs();
      }
    }, 2000); // Poll every 2 seconds
  }, [updateJobProgress, refreshJobs]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const deleteJob = useCallback(async (jobId: string) => {
    try {
      await JobManagementService.deleteJob(jobId);

      // Remove the job from the local state immediately
      setJobs(prevJobs => prevJobs.filter(job => job.id !== jobId));

      // Clear any errors since the operation was successful
      setError(null);
    } catch (err) {
      const error = err instanceof ApiError ? err : new ApiError(
        `Unexpected error: ${err instanceof Error ? err.message : 'Unknown error'}`,
        0,
        'UNKNOWN_ERROR'
      );
      setError(error);
      console.error('Failed to delete job:', error);
      throw error; // Re-throw so the UI can handle it
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const onScrollToTop = useCallback((callback: () => void) => {
    scrollToTopCallbackRef.current = callback;
  }, []);

  // Start polling when component mounts and jobs are loaded
  useEffect(() => {
    if (jobs.length > 0) {
      const hasActiveJobs = jobs.some(job => 
        job.status === 'in_progress' || job.status === 'queued'
      );
      
      if (hasActiveJobs) {
        startPolling();
      } else {
        stopPolling();
      }
    }

    return () => {
      stopPolling();
    };
  }, [jobs, startPolling, stopPolling]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  // Initial load - prevent duplicate calls in StrictMode
  useEffect(() => {
    if (!initialLoadRef.current) {
      initialLoadRef.current = true;
      refreshJobs();
    }
  }, []);

  return {
    jobs,
    loading,
    error,
    refreshJobs,
    clearError,
    addNewJob,
    deleteJob,
    onScrollToTop,
  };
}
