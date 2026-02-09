import { renderHook, act } from '@testing-library/react';
import { vi } from 'vitest';
import { useBookInfo } from '../useBookInfo';
import { useOpenLibrary } from '../useOpenLibrary';

vi.mock('../useOpenLibrary', () => ({
  useOpenLibrary: vi.fn(),
}));

describe('useBookInfo', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useOpenLibrary).mockReturnValue({
      fetchBookInfo: vi.fn(),
      loading: false,
      error: null,
      clearError: vi.fn(),
    });
  });

  it('should initialize with empty book info', () => {
    const { result } = renderHook(() => useBookInfo());

    expect(result.current.bookInfo).toEqual({
      bookName: '',
      author: '',
      series: '',
      year: '',
    });
  });

  it('should update book name', () => {
    const { result } = renderHook(() => useBookInfo());

    act(() => {
      result.current.setBookName('Test Book');
    });

    expect(result.current.bookInfo.bookName).toBe('Test Book');
  });

  it('should update author', () => {
    const { result } = renderHook(() => useBookInfo());

    act(() => {
      result.current.setAuthor('Test Author');
    });

    expect(result.current.bookInfo.author).toBe('Test Author');
  });

  it('should update multiple fields at once', () => {
    const { result } = renderHook(() => useBookInfo());

    act(() => {
      result.current.updateBookInfo({
        author: 'Jane Doe',
        year: '2023',
      });
    });

    expect(result.current.bookInfo.author).toBe('Jane Doe');
    expect(result.current.bookInfo.year).toBe('2023');
    expect(result.current.bookInfo.bookName).toBe('');
  });

  it('should reset book info', () => {
    const { result } = renderHook(() => useBookInfo());

    act(() => {
      result.current.setBookName('Test Book');
      result.current.setAuthor('Test Author');
    });

    act(() => {
      result.current.resetBookInfo();
    });

    expect(result.current.bookInfo).toEqual({
      bookName: '',
      author: '',
      series: '',
      year: '',
    });
  });

  it('should fetch book info from API', async () => {
    const mockFetchBookInfo = vi.fn().mockResolvedValue({
      author: 'API Author',
      publishYear: '2022',
    });

    vi.mocked(useOpenLibrary).mockReturnValue({
      fetchBookInfo: mockFetchBookInfo,
      loading: false,
      error: null,
      clearError: vi.fn(),
    });

    const { result } = renderHook(() => useBookInfo());

    await act(async () => {
      await result.current.fetchBookInfo('Test Book');
    });

    expect(mockFetchBookInfo).toHaveBeenCalledWith('Test Book');
    expect(result.current.bookInfo.author).toBe('API Author');
    expect(result.current.bookInfo.year).toBe('2022');
  });

  it('should handle API errors gracefully', async () => {
    const mockFetchBookInfo = vi.fn().mockResolvedValue(null);

    vi.mocked(useOpenLibrary).mockReturnValue({
      fetchBookInfo: mockFetchBookInfo,
      loading: false,
      error: new Error('API Error'),
      clearError: vi.fn(),
    });

    const { result } = renderHook(() => useBookInfo());

    await act(async () => {
      await result.current.fetchBookInfo('Test Book');
    });

    expect(mockFetchBookInfo).toHaveBeenCalledWith('Test Book');
    expect(result.current.bookInfo.author).toBe('');
    expect(result.current.bookInfo.year).toBe('');
  });
});
