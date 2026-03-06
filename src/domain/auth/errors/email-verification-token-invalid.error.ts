import { DomainError } from '@shared/errors/domain.error.js';

export class EmailVerificationTokenInvalidError extends DomainError {
  constructor() {
    super('Email verification token is invalid');
  }
}
