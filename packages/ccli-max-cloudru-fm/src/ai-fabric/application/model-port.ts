import type { Result } from '../../core/types/result.js';
import type { AiFabricError } from '../domain/errors.js';
import type { ModelRequest, ModelResponse } from '../domain/types.js';

export interface IModelPort {
  sendRequest(request: ModelRequest): Promise<Result<ModelResponse, AiFabricError>>;
  streamRequest(request: ModelRequest): AsyncIterable<string>;
  healthCheck(providerId: string): Promise<boolean>;
}
