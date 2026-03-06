import { DomainError } from '@shared/errors/domain.error.js';

export class UserAlreadyVerifiedError extends DomainError {
  constructor() {
    super('User email is already verified');
  }
}
