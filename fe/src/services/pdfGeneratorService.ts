import { UploadParams, PdfGenerationResponse } from '../types';
import { ApiError } from './errors';

/**
 * Service for interacting with the PDF Generator API
 */
export class PdfGeneratorService {
  private static readonly UPLOAD_ENDPOINT = '/api/upload';

  /**
   * Uploads a file and generates a PDF
   * @param file - The text file to upload
   * @param params - Upload parameters including book info and options
   * @returns Promise resolving to generation ID or null if failed
   * @throws ApiError if the request fails
   */
  static async generatePdf(file: File, params: UploadParams): Promise<string | null> {
    if (!file) {
      throw new ApiError('File is required', 400, 'INVALID_INPUT');
    }

    if (!file.name.endsWith('.txt')) {
      throw new ApiError('Invalid file type. Please select a .txt file.', 400, 'INVALID_FILE_TYPE');
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('params', JSON.stringify(params));

    try {
      const response = await fetch(this.UPLOAD_ENDPOINT, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new ApiError(
          `Failed to generate PDF: ${response.statusText}`,
          response.status,
          'GENERATION_ERROR'
        );
      }

      const data: PdfGenerationResponse = await response.json();
      
      if (!data.id) {
        throw new ApiError(
          'Invalid response from server: missing generation ID',
          500,
          'INVALID_RESPONSE'
        );
      }

      return data.id;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      
      // Handle network errors, JSON parsing errors, etc.
      throw new ApiError(
        `Network error while generating PDF: ${error instanceof Error ? error.message : 'Unknown error'}`,
        0,
        'NETWORK_ERROR'
      );
    }
  }

  /**
   * Constructs the download URL for a generated PDF
   * @param id - The generation ID
   * @returns The download URL
   */
  static getDownloadUrl(id: string): string {
    return `/api/download?id=${id}`;
  }
}
