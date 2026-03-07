import { DomainError } from '@shared/errors/domain.error.js';

export class InvalidGoogleIdError extends DomainError {
  constructor() {
    super('Google ID cannot be empty');
  }
}
