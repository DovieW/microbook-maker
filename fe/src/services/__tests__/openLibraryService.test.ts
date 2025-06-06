import { OpenLibraryService, ApiError } from '../openLibraryService';

// Mock fetch globally
global.fetch = jest.fn();

describe('OpenLibraryService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchBookInfo', () => {
    it('should fetch book information successfully', async () => {
      const mockResponse = {
        docs: [
          {
            author_name: ['Test Author'],
            first_publish_year: 2020,
          },
        ],
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await OpenLibraryService.fetchBookInfo('Test Book');

      expect(result).toEqual({
        author: 'Test Author',
        publishYear: '2020',
      });
      expect(fetch).toHaveBeenCalledWith(
        'https://openlibrary.org/search.json?q=Test%20Book'
      );
    });

    it('should return null when no books are found', async () => {
      const mockResponse = {
        docs: [],
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await OpenLibraryService.fetchBookInfo('Nonexistent Book');

      expect(result).toBeNull();
    });

    it('should throw ApiError when fetch fails', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(
        OpenLibraryService.fetchBookInfo('Test Book')
      ).rejects.toThrow(ApiError);
    });

    it('should throw ApiError when title is empty', async () => {
      await expect(
        OpenLibraryService.fetchBookInfo('')
      ).rejects.toThrow(ApiError);
    });

    it('should handle network errors', async () => {
      (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      await expect(
        OpenLibraryService.fetchBookInfo('Test Book')
      ).rejects.toThrow(ApiError);
    });

    it('should handle books without author or year', async () => {
      const mockResponse = {
        docs: [
          {
            // No author_name or first_publish_year
          },
        ],
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await OpenLibraryService.fetchBookInfo('Test Book');

      expect(result).toEqual({
        author: '',
        publishYear: '',
      });
    });
  });
});
