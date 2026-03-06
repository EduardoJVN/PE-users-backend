import { DomainError } from '@shared/errors/domain.error.js';

export class EmailAlreadyExistsError extends DomainError {
  constructor(email: string) {
    super(`Email already registered: ${email}`);
  }
}
