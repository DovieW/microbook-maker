import { PdfGeneratorService } from '../pdfGeneratorService';
import { ApiError } from '../openLibraryService';
import { UploadParams } from '../../types';

// Mock fetch globally
global.fetch = jest.fn();

describe('PdfGeneratorService', () => {
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

  describe('generatePdf', () => {
    it('should generate PDF successfully', async () => {
      const mockResponse = {
        id: 'test-generation-id',
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await PdfGeneratorService.generatePdf(mockFile, mockParams);

      expect(result).toBe('test-generation-id');
      expect(fetch).toHaveBeenCalledWith('/api/upload', {
        method: 'POST',
        body: expect.any(FormData),
      });
    });

    it('should throw ApiError when file is not provided', async () => {
      await expect(
        PdfGeneratorService.generatePdf(null as any, mockParams)
      ).rejects.toThrow(ApiError);
    });

    it('should throw ApiError for invalid file type', async () => {
      const invalidFile = new File(['test'], 'test.pdf', { type: 'application/pdf' });

      await expect(
        PdfGeneratorService.generatePdf(invalidFile, mockParams)
      ).rejects.toThrow(ApiError);
    });

    it('should throw ApiError when server returns error', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
      });

      await expect(
        PdfGeneratorService.generatePdf(mockFile, mockParams)
      ).rejects.toThrow(ApiError);
    });

    it('should throw ApiError when response is missing ID', async () => {
      const mockResponse = {
        // Missing id field
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      await expect(
        PdfGeneratorService.generatePdf(mockFile, mockParams)
      ).rejects.toThrow(ApiError);
    });

    it('should handle network errors', async () => {
      (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      await expect(
        PdfGeneratorService.generatePdf(mockFile, mockParams)
      ).rejects.toThrow(ApiError);
    });
  });

  describe('getDownloadUrl', () => {
    it('should return correct download URL', () => {
      const id = 'test-id';
      const url = PdfGeneratorService.getDownloadUrl(id);
      expect(url).toBe('/api/download?id=test-id');
    });
  });
});
