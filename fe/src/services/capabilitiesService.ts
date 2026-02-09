import { CapabilitiesResponse } from '../types';
import { ApiError } from './errors';

/**
 * Service for fetching backend generation capabilities
 */
export class CapabilitiesService {
  private static readonly CAPABILITIES_ENDPOINT = '/api/capabilities';

  static async fetchCapabilities(): Promise<CapabilitiesResponse> {
    try {
      const response = await fetch(this.CAPABILITIES_ENDPOINT);

      if (!response.ok) {
        throw new ApiError(
          `Failed to fetch capabilities: ${response.statusText}`,
          response.status,
          'FETCH_CAPABILITIES_ERROR'
        );
      }

      const data: CapabilitiesResponse = await response.json();

      if (!Array.isArray(data.acceptedFormats) || !Array.isArray(data.fontOptions)) {
        throw new ApiError('Invalid capabilities response', 500, 'INVALID_RESPONSE');
      }

      return data;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      throw new ApiError(
        `Network error while fetching capabilities: ${error instanceof Error ? error.message : 'Unknown error'}`,
        0,
        'NETWORK_ERROR'
      );
    }
  }
}
