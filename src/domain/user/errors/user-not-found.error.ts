import { NotFoundError } from '@shared/errors/not-found.error.js';

export class UserNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(`User not found: ${id}`);
  }
}
