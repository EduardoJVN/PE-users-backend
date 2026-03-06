import { DomainError } from '@shared/errors/domain.error.js';

export class UserNotVerifiedError extends DomainError {
  constructor() {
    super('User email is not verified. Please verify your email before logging in');
  }
}
