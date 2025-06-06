import { renderHook, act } from '@testing-library/react';
import { usePdfGenerator } from '../usePdfGenerator';
import { PdfGeneratorService } from '../../services/pdfGeneratorService';
import { UploadParams } from '../../types';

// Mock the service
jest.mock('../../services/pdfGeneratorService');

describe('usePdfGenerator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockFile = new File(['test content'], 'test.txt', { type: 'text/plain' });
  const mockParams: UploadParams = {
    bookName: 'Test Book',
    borderStyle: 'dashed',
    headerInfo: {
      series: 'Test Series',
      sheetsCount: '10',
      wordCount: 1000,
      readTime: '5 minutes',
      author: 'Test Author',
      year: '2023',
      fontSize: '6',
    },
  };

  it('should initialize with correct default state', () => {
    const { result } = renderHook(() => usePdfGenerator());

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(typeof result.current.generatePdf).toBe('function');
    expect(typeof result.current.clearError).toBe('function');
  });

  it('should generate PDF successfully', async () => {
    const mockGenerationId = 'test-generation-id';
    (PdfGeneratorService.generatePdf as jest.Mock).mockResolvedValue(mockGenerationId);

    const { result } = renderHook(() => usePdfGenerator());

    let generateResult: any;
    await act(async () => {
      generateResult = await result.current.generatePdf(mockFile, mockParams);
    });

    expect(generateResult).toBe(mockGenerationId);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(PdfGeneratorService.generatePdf).toHaveBeenCalledWith(mockFile, mockParams);
  });

  it('should handle loading state correctly', async () => {
    (PdfGeneratorService.generatePdf as jest.Mock).mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve('test-id'), 100))
    );

    const { result } = renderHook(() => usePdfGenerator());

    act(() => {
      result.current.generatePdf(mockFile, mockParams);
    });

    expect(result.current.loading).toBe(true);

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 150));
    });

    expect(result.current.loading).toBe(false);
  });

  it('should handle errors correctly', async () => {
    const mockError = new Error('Generation Error');
    (PdfGeneratorService.generatePdf as jest.Mock).mockRejectedValue(mockError);

    const { result } = renderHook(() => usePdfGenerator());

    let generateResult: any;
    await act(async () => {
      generateResult = await result.current.generatePdf(mockFile, mockParams);
    });

    expect(generateResult).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeTruthy();
  });

  it('should clear error when clearError is called', async () => {
    const mockError = new Error('Generation Error');
    (PdfGeneratorService.generatePdf as jest.Mock).mockRejectedValue(mockError);

    const { result } = renderHook(() => usePdfGenerator());

    await act(async () => {
      await result.current.generatePdf(mockFile, mockParams);
    });

    expect(result.current.error).toBeTruthy();

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });

  it('should handle missing file', async () => {
    const { result } = renderHook(() => usePdfGenerator());

    let generateResult: any;
    await act(async () => {
      generateResult = await result.current.generatePdf(null as any, mockParams);
    });

    expect(generateResult).toBeNull();
    expect(result.current.error).toBeTruthy();
  });
});
