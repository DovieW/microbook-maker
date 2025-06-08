import { JobsResponse } from '../types';
import { ApiError } from './errors';

/**
 * Service for managing PDF generation jobs
 */
export class JobManagementService {
  private static readonly JOBS_ENDPOINT = '/api/jobs';

  /**
   * Fetches all jobs from the backend
   * @returns Promise resolving to jobs list
   * @throws ApiError if the request fails
   */
  static async fetchJobs(): Promise<JobsResponse> {
    try {
      const response = await fetch(this.JOBS_ENDPOINT);

      if (!response.ok) {
        throw new ApiError(
          `Failed to fetch jobs: ${response.statusText}`,
          response.status,
          'FETCH_JOBS_ERROR'
        );
      }

      const data: JobsResponse = await response.json();
      return data;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      
      // Handle network errors, JSON parsing errors, etc.
      throw new ApiError(
        `Network error while fetching jobs: ${error instanceof Error ? error.message : 'Unknown error'}`,
        0,
        'NETWORK_ERROR'
      );
    }
  }

  /**
   * Gets the download URL for a completed job
   * @param jobId - The job ID
   * @returns The download URL
   */
  static getDownloadUrl(jobId: string): string {
    return `/api/download?id=${jobId}`;
  }

  /**
   * Gets the original file URL for a job (if available)
   * @param uploadPath - The upload path from job data
   * @returns The file URL or null if not available
   */
  static getOriginalFileUrl(uploadPath: string | null): string | null {
    if (!uploadPath) return null;
    return `/uploads/${uploadPath}`;
  }

  /**
   * Deletes a job and all associated files
   * @param jobId - The job ID to delete
   * @returns Promise resolving to deletion result
   * @throws ApiError if the request fails
   */
  static async deleteJob(jobId: string): Promise<{ message: string; deletedFiles: string[] }> {
    try {
      const response = await fetch(`${this.JOBS_ENDPOINT}/${jobId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new ApiError(
          errorData.message || `Failed to delete job: ${response.statusText}`,
          response.status,
          'DELETE_JOB_ERROR'
        );
      }

      const data = await response.json();
      return data;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      // Handle network errors, JSON parsing errors, etc.
      throw new ApiError(
        `Network error while deleting job: ${error instanceof Error ? error.message : 'Unknown error'}`,
        0,
        'NETWORK_ERROR'
      );
    }
  }
}
