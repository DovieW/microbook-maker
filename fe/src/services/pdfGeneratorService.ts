import { UploadParams, PdfGenerationResponse, ProgressResponse, ProgressInfo } from '../types';
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
   * Checks the progress of PDF generation
   * @param id - The generation ID
   * @returns Promise resolving to progress information
   * @throws ApiError if the request fails
   */
  static async checkProgress(id: string): Promise<ProgressResponse> {
    if (!id) {
      throw new ApiError('Generation ID is required', 400, 'INVALID_INPUT');
    }

    try {
      const response = await fetch(`/api/progress/${id}`);

      if (!response.ok) {
        throw new ApiError(
          `Failed to check progress: ${response.statusText}`,
          response.status,
          'PROGRESS_CHECK_ERROR'
        );
      }

      const contentType = response.headers.get('content-type');

      // Expect JSON response from the new progress endpoint
      if (contentType?.includes('application/json')) {
        const data = await response.json();
        return data as ProgressResponse;
      }

      // Fallback for non-JSON responses
      const text = await response.text();

      if (text.startsWith('ERROR:')) {
        return {
          status: 'error',
          message: text.replace('ERROR: ', ''),
        };
      }

      // Parse progress text as fallback
      const progress = this.parseProgressText(text);
      return {
        status: 'in_progress',
        progress,
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      throw new ApiError(
        `Network error while checking progress: ${error instanceof Error ? error.message : 'Unknown error'}`,
        0,
        'NETWORK_ERROR'
      );
    }
  }

  /**
   * Parses progress text from backend into structured progress info
   * @param text - Raw progress text from backend
   * @returns Structured progress information
   */
  private static parseProgressText(text: string): ProgressInfo {
    // Default progress info
    let progress: ProgressInfo = {
      step: text,
      percentage: 0,
      isComplete: false,
      isError: false,
    };

    // Parse different progress messages
    if (text.includes('Creating:')) {
      progress.step = 'Initializing';
      progress.percentage = 10;
    } else if (text.includes('Creating sheet')) {
      // Extract sheet numbers: "Creating sheet 5 of 10-ish."
      const match = text.match(/Creating sheet (\d+(?:\.\d+)?) of (\d+)/);
      if (match) {
        const current = parseFloat(match[1]);
        const total = parseInt(match[2]);
        progress.currentSheet = Math.floor(current);
        progress.totalSheets = total;
        progress.percentage = Math.min(90, Math.round((current / total) * 80) + 10); // 10-90% range
        progress.step = `Creating sheet ${Math.floor(current)} of ${total}`;
      } else {
        progress.step = 'Creating pages';
        progress.percentage = 50;
      }
    } else if (text.includes('Finished creating pages')) {
      progress.step = 'Generating PDF';
      progress.percentage = 95;
    } else if (text.includes('Writing to file')) {
      progress.step = 'Finalizing PDF';
      progress.percentage = 98;
    } else {
      // Generic progress based on keywords
      if (text.toLowerCase().includes('start')) {
        progress.percentage = 5;
      } else if (text.toLowerCase().includes('process')) {
        progress.percentage = 30;
      } else if (text.toLowerCase().includes('finish')) {
        progress.percentage = 90;
      }
    }

    return progress;
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
