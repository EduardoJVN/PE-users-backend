import { DomainError } from '@shared/errors/domain.error.js';

export class RefreshTokenInvalidError extends DomainError {
  constructor() {
    super('Refresh token is invalid');
  }
}
