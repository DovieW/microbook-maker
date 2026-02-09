import { renderHook, act } from '@testing-library/react';
import { vi } from 'vitest';
import { useProgressPolling } from '../useProgressPolling';
import { PdfGeneratorService } from '../../services/pdfGeneratorService';

// Mock the PdfGeneratorService
vi.mock('../../services/pdfGeneratorService');

describe('useProgressPolling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const mockCheckProgress = PdfGeneratorService.checkProgress as any;

  it('should not poll when disabled', () => {
    renderHook(() => useProgressPolling({
      generationId: 'test-id',
      enabled: false,
    }));

    expect(mockCheckProgress).not.toHaveBeenCalled();
  });

  it('should not poll when no generation ID', () => {
    renderHook(() => useProgressPolling({
      generationId: null,
      enabled: true,
    }));

    expect(mockCheckProgress).not.toHaveBeenCalled();
  });

  it('should poll when enabled with generation ID', async () => {
    mockCheckProgress.mockResolvedValue({
      status: 'in_progress',
      progress: {
        step: 'Creating pages',
        percentage: 50,
        isComplete: false,
        isError: false,
      },
    });

    const { result } = renderHook(() => useProgressPolling({
      generationId: 'test-id',
      enabled: true,
      interval: 1000,
    }));

    expect(result.current.isPolling).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });

    expect(mockCheckProgress).toHaveBeenCalledWith('test-id');
    expect(result.current.progress).toEqual({
      step: 'Creating pages',
      percentage: 50,
      isComplete: false,
      isError: false,
    });
  });

  it('should call onComplete when generation is finished', async () => {
    const onComplete = vi.fn();
    
    mockCheckProgress.mockResolvedValue({
      status: 'completed',
      progress: {
        step: 'Complete',
        percentage: 100,
        isComplete: true,
        isError: false,
      },
    });

    renderHook(() => useProgressPolling({
      generationId: 'test-id',
      enabled: true,
      onComplete,
    }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });

    expect(onComplete).toHaveBeenCalledWith({
      step: 'Complete',
      percentage: 100,
      isComplete: true,
      isError: false,
    });
  });

  it('should call onError when generation fails', async () => {
    const onError = vi.fn();
    
    mockCheckProgress.mockResolvedValue({
      status: 'error',
      message: 'Generation failed',
    });

    renderHook(() => useProgressPolling({
      generationId: 'test-id',
      enabled: true,
      onError,
    }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });

    expect(onError).toHaveBeenCalledWith('Generation failed');
  });
});
