import type { Result } from '../../core/types/result.js';
import type { MessengerError } from '../domain/errors.js';

/**
 * Injectable HTTP client interface for messenger adapters
 * Allows for testing without real HTTP calls
 */
export interface IHttpClient {
  /**
   * Send POST request with JSON body
   */
  post<T>(
    url: string,
    body: unknown,
    headers?: Record<string, string>
  ): Promise<Result<T, MessengerError>>;

  /**
   * Send GET request
   */
  get<T>(
    url: string,
    headers?: Record<string, string>
  ): Promise<Result<T, MessengerError>>;
}
