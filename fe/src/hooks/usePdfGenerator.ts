import { useState, useCallback } from 'react';
import { PdfGeneratorService } from '../services/pdfGeneratorService';
import { ApiError } from '../services/errors';
import { UploadParams, UsePdfGeneratorReturn } from '../types';

/**
 * Custom hook for interacting with the PDF Generator API
 * Provides loading states, error handling, and PDF generation functionality
 */
export function usePdfGenerator(): UsePdfGeneratorReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const generatePdf = useCallback(async (file: File, params: UploadParams): Promise<string | null> => {
    if (!file) {
      setError(new ApiError('File is required', 400, 'INVALID_INPUT'));
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const generationId = await PdfGeneratorService.generatePdf(file, params);
      return generationId;
    } catch (err) {
      const error = err instanceof ApiError ? err : new ApiError(
        `Unexpected error: ${err instanceof Error ? err.message : 'Unknown error'}`,
        0,
        'UNKNOWN_ERROR'
      );
      setError(error);
      console.error('Failed to generate PDF:', error);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    generatePdf,
    loading,
    error,
    clearError,
  };
}
