import { DomainError } from '@shared/errors/domain.error.js';

export class RefreshTokenExpiredError extends DomainError {
  constructor() {
    super('Refresh token has expired');
  }
}
