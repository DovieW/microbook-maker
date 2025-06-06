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

              // Auto-open PDF when completed (user preference)
              if (job.status !== 'completed') {
                const downloadUrl = JobManagementService.getDownloadUrl(jobId);
                window.open(downloadUrl, '_blank');
              }
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
      // Update progress for in-progress jobs
      const inProgressJobs = jobs.filter(job =>
        job.status === 'in_progress' || job.status === 'queued'
      );

      inProgressJobs.forEach(job => {
        updateJobProgress(job.id);
      });

      // Refresh job list periodically to catch new jobs
      if (Math.random() < 0.1) { // 10% chance each interval (every ~20 seconds on average)
        refreshJobs();
      }
    }, 2000); // Poll every 2 seconds
  }, [jobs, updateJobProgress, refreshJobs]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
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

  // Initial load
  useEffect(() => {
    refreshJobs();
  }, []);

  return {
    jobs,
    loading,
    error,
    refreshJobs,
    clearError,
  };
}
