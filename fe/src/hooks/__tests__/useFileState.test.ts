import { renderHook, act } from '@testing-library/react';
import { useFileState } from '../useFileState';

describe('useFileState', () => {

  it('should initialize with default file state', () => {
    const { result } = renderHook(() => useFileState());

    expect(result.current.fileState).toEqual({
      fileName: '',
      wordCount: 0,
      sheetsCount: 0,
      readTime: '--',
      disableUpload: true,
    });
  });

  it('should update file name', () => {
    const { result } = renderHook(() => useFileState());

    act(() => {
      result.current.setFileName('test.txt');
    });

    expect(result.current.fileState.fileName).toBe('test.txt');
  });

  it('should update file stats', () => {
    const { result } = renderHook(() => useFileState());

    act(() => {
      result.current.updateFileStats(5000, '6');
    });

    expect(result.current.fileState.wordCount).toBe(5000);
    expect(result.current.fileState.sheetsCount).toBeGreaterThan(0); // Should calculate sheets
    expect(result.current.fileState.readTime).toContain('minute'); // Should calculate read time
  });

  it('should validate upload correctly', () => {
    const { result } = renderHook(() => useFileState());

    // Valid font size with file
    act(() => {
      result.current.validateUpload('6', true);
    });
    expect(result.current.fileState.disableUpload).toBe(false);

    // Invalid font size
    act(() => {
      result.current.validateUpload('2', true);
    });
    expect(result.current.fileState.disableUpload).toBe(true);

    // Valid font size but no file
    act(() => {
      result.current.validateUpload('6', false);
    });
    expect(result.current.fileState.disableUpload).toBe(true);
  });

  it('should reset file state', () => {
    const { result } = renderHook(() => useFileState());

    // Set some values first
    act(() => {
      result.current.setFileName('test.txt');
      result.current.setWordCount(1000);
    });

    // Reset
    act(() => {
      result.current.resetFileState();
    });

    expect(result.current.fileState).toEqual({
      fileName: '',
      wordCount: 0,
      sheetsCount: 0,
      readTime: '--',
      disableUpload: true,
    });
  });

  it('should set sheets count to 0 for invalid font size during validation', () => {
    const { result } = renderHook(() => useFileState());

    act(() => {
      result.current.validateUpload('15', true); // Invalid font size
    });

    expect(result.current.fileState.sheetsCount).toBe(0);
    expect(result.current.fileState.disableUpload).toBe(true);
  });
});
