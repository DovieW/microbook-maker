import { renderHook, act } from '@testing-library/react';
import { usePdfOptions } from '../usePdfOptions';

describe('usePdfOptions', () => {
  it('initializes with arial default font family', () => {
    const { result } = renderHook(() => usePdfOptions());

    expect(result.current.pdfOptions.fontFamily).toBe('arial');
  });

  it('updates font family', () => {
    const { result } = renderHook(() => usePdfOptions());

    act(() => {
      result.current.setFontFamily('times-new-roman');
    });

    expect(result.current.pdfOptions.fontFamily).toBe('times-new-roman');
  });
});
