import { DomainError } from '@shared/errors/domain.error.js';

export class InvalidEmailFormatError extends DomainError {
  constructor(email: string) {
    super(`Invalid email format: ${email}`);
  }
}
