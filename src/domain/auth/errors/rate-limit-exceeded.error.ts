import { DomainError } from '@shared/errors/domain.error.js';

export class RateLimitExceededError extends DomainError {
  public readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super(`Rate limit exceeded. Try again in ${retryAfterSeconds} seconds`);
    this.retryAfterSeconds = retryAfterSeconds;
  }
}
