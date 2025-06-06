import { OpenLibraryResponse, BookInfoResult } from '../types';
import { ApiError } from './errors';

// Re-export ApiError for convenience
export { ApiError } from './errors';

/**
 * Service for interacting with the OpenLibrary API
 */
export class OpenLibraryService {
  private static readonly BASE_URL = 'https://openlibrary.org/search.json';

  /**
   * Fetches book information from OpenLibrary API
   * @param title - The book title to search for
   * @returns Promise resolving to book info or null if not found
   * @throws ApiError if the request fails
   */
  static async fetchBookInfo(title: string): Promise<BookInfoResult | null> {
    if (!title.trim()) {
      throw new ApiError('Book title is required', 400, 'INVALID_INPUT');
    }

    const encodedTitle = encodeURIComponent(title.trim());
    const url = `${this.BASE_URL}?q=${encodedTitle}`;

    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new ApiError(
          `Failed to fetch book information: ${response.statusText}`,
          response.status,
          'FETCH_ERROR'
        );
      }

      const data: OpenLibraryResponse = await response.json();
      
      if (!data.docs || data.docs.length === 0) {
        console.log('No book found with that title.');
        return null;
      }

      const book = data.docs[0];
      return {
        author: book.author_name ? book.author_name[0] : '',
        publishYear: book.first_publish_year ? book.first_publish_year.toString() : '',
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      
      // Handle network errors, JSON parsing errors, etc.
      throw new ApiError(
        `Network error while fetching book information: ${error instanceof Error ? error.message : 'Unknown error'}`,
        0,
        'NETWORK_ERROR'
      );
    }
  }
}


