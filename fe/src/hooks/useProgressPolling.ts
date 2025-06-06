import { useState, useEffect, useCallback, useRef } from 'react';
import { ProgressInfo } from '../types';
import { PdfGeneratorService } from '../services/pdfGeneratorService';

interface UseProgressPollingOptions {
  generationId: string | null;
  enabled: boolean;
  interval?: number;
  fastInterval?: number; // Faster polling for first few checks
  onComplete?: (progress: ProgressInfo) => void;
  onError?: (error: string) => void;
}

/**
 * Custom hook for polling PDF generation progress
 * Automatically polls the backend for progress updates when enabled
 */
export function useProgressPolling({
  generationId,
  enabled,
  interval = 2000, // Poll every 2 seconds
  fastInterval = 500, // Poll every 500ms initially
  onComplete,
  onError,
}: UseProgressPollingOptions) {
  const [progress, setProgress] = useState<ProgressInfo | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastGenerationIdRef = useRef<string | null>(null);
  const pollCountRef = useRef<number>(0);

  const pollProgress = useCallback(async () => {
    if (!generationId) return;

    try {
      const response = await PdfGeneratorService.checkProgress(generationId);
      pollCountRef.current += 1;

      if (response.status === 'completed' && response.progress) {
        setProgress(response.progress);
        setIsPolling(false);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        onComplete?.(response.progress);
      } else if (response.status === 'error') {
        setIsPolling(false);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        const errorMessage = response.message || 'PDF generation failed';
        onError?.(errorMessage);
        setProgress({
          step: 'Error',
          percentage: 0,
          isComplete: false,
          isError: true,
          errorMessage,
        });
      } else if (response.status === 'in_progress' && response.progress) {
        setProgress(response.progress);

        // Switch to slower polling after first 10 polls (5 seconds with fast interval)
        if (pollCountRef.current === 10 && intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = setInterval(pollProgress, interval);
        }
      } else if (response.status === 'not_found') {
        setIsPolling(false);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        onError?.('Generation not found or has expired');
      }
    } catch (error) {
      console.error('Failed to poll progress:', error);
      setIsPolling(false);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      // More specific error handling
      if (error instanceof Error) {
        if (error.message.includes('502') || error.message.includes('Bad Gateway')) {
          onError?.('Server temporarily unavailable. Please try again.');
        } else if (error.message.includes('404')) {
          onError?.('Progress endpoint not found. Please refresh and try again.');
        } else {
          onError?.(`Failed to check progress: ${error.message}`);
        }
      } else {
        onError?.('Failed to check progress');
      }
    }
  }, [generationId, onComplete, onError, interval]);

  // Start polling when enabled and generationId is available
  useEffect(() => {
    if (enabled && generationId && generationId !== lastGenerationIdRef.current) {
      // Reset progress when starting a new generation
      setProgress({
        step: 'Starting PDF generation...',
        percentage: 0,
        isComplete: false,
        isError: false,
      });
      setIsPolling(true);
      lastGenerationIdRef.current = generationId;
      pollCountRef.current = 0; // Reset poll count

      // Start immediate poll after a short delay to allow backend to initialize
      setTimeout(() => {
        pollProgress();
      }, 500);

      // Set up fast initial polling (500ms for first 10 polls, then switch to normal interval)
      intervalRef.current = setInterval(pollProgress, fastInterval);
    } else if (!enabled || !generationId) {
      setIsPolling(false);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, generationId, interval, fastInterval]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const stopPolling = useCallback(() => {
    setIsPolling(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const resetProgress = useCallback(() => {
    setProgress(null);
    lastGenerationIdRef.current = null;
  }, []);

  return {
    progress,
    isPolling,
    stopPolling,
    resetProgress,
  };
}
