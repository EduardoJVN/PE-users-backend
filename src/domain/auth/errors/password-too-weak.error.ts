import { DomainError } from '@shared/errors/domain.error.js';

export class PasswordTooWeakError extends DomainError {
  constructor() {
    super(
      'Password must be at least 8 characters and contain an uppercase letter, a number, and a special character',
    );
  }
}
