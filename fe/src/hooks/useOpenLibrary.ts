import { useState, useCallback } from 'react';
import { OpenLibraryService } from '../services/openLibraryService';
import { ApiError } from '../services/errors';
import { BookInfoResult, UseOpenLibraryReturn } from '../types';

/**
 * Custom hook for interacting with the OpenLibrary API
 * Provides loading states, error handling, and book info fetching functionality
 */
export function useOpenLibrary(): UseOpenLibraryReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchBookInfo = useCallback(async (title: string): Promise<BookInfoResult | null> => {
    if (!title.trim()) {
      setError(new ApiError('Book title is required', 400, 'INVALID_INPUT'));
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await OpenLibraryService.fetchBookInfo(title);
      return result;
    } catch (err) {
      const error = err instanceof ApiError ? err : new ApiError(
        `Unexpected error: ${err instanceof Error ? err.message : 'Unknown error'}`,
        0,
        'UNKNOWN_ERROR'
      );
      setError(error);
      console.error('Failed to fetch book info:', error);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    fetchBookInfo,
    loading,
    error,
    clearError,
  };
}
