import { useCallback, useEffect, useState } from 'react';
import { CapabilitiesResponse } from '../types';
import { CapabilitiesService } from '../services/capabilitiesService';
import { ApiError } from '../services/errors';

const fallbackCapabilities: CapabilitiesResponse = {
  acceptedFormats: ['.txt', '.md', '.markdown'],
  maxUploadSizeBytes: 10 * 1024 * 1024,
  fontOptions: [
    { value: 'arial', label: 'Arial' },
    { value: 'times-new-roman', label: 'Times New Roman' },
    { value: 'georgia', label: 'Georgia' },
    { value: 'courier-new', label: 'Courier New' },
    { value: 'dejavu-sans', label: 'DejaVu Sans' },
    { value: 'dejavu-serif', label: 'DejaVu Serif' },
    { value: 'dejavu-sans-mono', label: 'DejaVu Sans Mono' },
  ],
  defaults: {
    format: '.txt',
    borderStyle: 'dashed',
    fontSize: '6',
    fontFamily: 'arial',
  },
};

export function useCapabilities() {
  const [capabilities, setCapabilities] = useState<CapabilitiesResponse>(fallbackCapabilities);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refreshCapabilities = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await CapabilitiesService.fetchCapabilities();
      setCapabilities(response);
    } catch (err) {
      const parsedError = err instanceof ApiError
        ? err
        : new ApiError(
          `Unexpected error while loading capabilities: ${err instanceof Error ? err.message : 'Unknown error'}`,
          0,
          'UNKNOWN_ERROR'
        );

      setError(parsedError);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshCapabilities();
  }, [refreshCapabilities]);

  return {
    capabilities,
    capabilitiesLoading: loading,
    capabilitiesError: error,
    refreshCapabilities,
  };
}
