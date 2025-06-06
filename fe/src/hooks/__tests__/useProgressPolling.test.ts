import { renderHook, act } from '@testing-library/react';
import { useProgressPolling } from '../useProgressPolling';
import { PdfGeneratorService } from '../../services/pdfGeneratorService';

// Mock the PdfGeneratorService
jest.mock('../../services/pdfGeneratorService');

describe('useProgressPolling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const mockCheckProgress = PdfGeneratorService.checkProgress as jest.MockedFunction<typeof PdfGeneratorService.checkProgress>;

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

    // Wait for initial poll
    await act(async () => {
      await Promise.resolve();
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
    const onComplete = jest.fn();
    
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
      await Promise.resolve();
    });

    expect(onComplete).toHaveBeenCalledWith({
      step: 'Complete',
      percentage: 100,
      isComplete: true,
      isError: false,
    });
  });

  it('should call onError when generation fails', async () => {
    const onError = jest.fn();
    
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
      await Promise.resolve();
    });

    expect(onError).toHaveBeenCalledWith('Generation failed');
  });
});
