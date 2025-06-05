import { renderHook, act } from '@testing-library/react';
import { useBookInfo } from '../useBookInfo';

// Mock the getBookInfo utility
jest.mock('../../utils', () => ({
  getBookInfo: jest.fn(),
}));

describe('useBookInfo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
    expect(result.current.bookInfo.bookName).toBe(''); // Should remain unchanged
  });

  it('should reset book info', () => {
    const { result } = renderHook(() => useBookInfo());

    // Set some values first
    act(() => {
      result.current.setBookName('Test Book');
      result.current.setAuthor('Test Author');
    });

    // Reset
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
    const mockGetBookInfo = require('../../utils').getBookInfo;
    mockGetBookInfo.mockResolvedValue({
      author: 'API Author',
      publishYear: '2022',
    });

    const { result } = renderHook(() => useBookInfo());

    await act(async () => {
      await result.current.fetchBookInfo('Test Book');
    });

    expect(mockGetBookInfo).toHaveBeenCalledWith('Test Book');
    expect(result.current.bookInfo.author).toBe('API Author');
    expect(result.current.bookInfo.year).toBe('2022');
  });

  it('should handle API errors gracefully', async () => {
    const mockGetBookInfo = require('../../utils').getBookInfo;
    mockGetBookInfo.mockRejectedValue(new Error('API Error'));

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    const { result } = renderHook(() => useBookInfo());

    await act(async () => {
      await result.current.fetchBookInfo('Test Book');
    });

    expect(consoleSpy).toHaveBeenCalledWith('Failed to fetch book info:', expect.any(Error));
    
    consoleSpy.mockRestore();
  });
});
