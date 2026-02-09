import { renderHook, act } from '@testing-library/react';
import { vi } from 'vitest';
import { useOpenLibrary } from '../useOpenLibrary';
import { OpenLibraryService } from '../../services/openLibraryService';

// Mock the service
vi.mock('../../services/openLibraryService');

describe('useOpenLibrary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with correct default state', () => {
    const { result } = renderHook(() => useOpenLibrary());

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(typeof result.current.fetchBookInfo).toBe('function');
    expect(typeof result.current.clearError).toBe('function');
  });

  it('should fetch book info successfully', async () => {
    const mockBookInfo = {
      author: 'Test Author',
      publishYear: '2023',
    };

    (OpenLibraryService.fetchBookInfo as any).mockResolvedValue(mockBookInfo);

    const { result } = renderHook(() => useOpenLibrary());

    let fetchResult: any;
    await act(async () => {
      fetchResult = await result.current.fetchBookInfo('Test Book');
    });

    expect(fetchResult).toEqual(mockBookInfo);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(OpenLibraryService.fetchBookInfo).toHaveBeenCalledWith('Test Book');
  });

  it('should handle loading state correctly', async () => {
    (OpenLibraryService.fetchBookInfo as any).mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve(null), 100))
    );

    const { result } = renderHook(() => useOpenLibrary());

    act(() => {
      result.current.fetchBookInfo('Test Book');
    });

    expect(result.current.loading).toBe(true);

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 150));
    });

    expect(result.current.loading).toBe(false);
  });

  it('should handle errors correctly', async () => {
    const mockError = new Error('API Error');
    (OpenLibraryService.fetchBookInfo as any).mockRejectedValue(mockError);

    const { result } = renderHook(() => useOpenLibrary());

    let fetchResult: any;
    await act(async () => {
      fetchResult = await result.current.fetchBookInfo('Test Book');
    });

    expect(fetchResult).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeTruthy();
  });

  it('should clear error when clearError is called', async () => {
    const mockError = new Error('API Error');
    (OpenLibraryService.fetchBookInfo as any).mockRejectedValue(mockError);

    const { result } = renderHook(() => useOpenLibrary());

    await act(async () => {
      await result.current.fetchBookInfo('Test Book');
    });

    expect(result.current.error).toBeTruthy();

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });

  it('should handle empty title', async () => {
    const { result } = renderHook(() => useOpenLibrary());

    let fetchResult: any;
    await act(async () => {
      fetchResult = await result.current.fetchBookInfo('');
    });

    expect(fetchResult).toBeNull();
    expect(result.current.error).toBeTruthy();
  });
});
