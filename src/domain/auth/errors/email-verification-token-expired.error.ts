import { DomainError } from '@shared/errors/domain.error.js';

export class EmailVerificationTokenExpiredError extends DomainError {
  constructor() {
    super('Email verification token has expired');
  }
}
