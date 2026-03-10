import type { IUserRepository } from '@domain/user/ports/user.repository.port.js';
import type { ILogger } from '@domain/ports/logger.port.js';
import type { GetMeCommand, GetMeResult } from '@application/user/dto/get-me.dto.js';
import { UserNotFoundError } from '@domain/user/errors/user-not-found.error.js';

export class GetMeUseCase {
  constructor(
    private readonly repo: IUserRepository,
    private readonly logger: ILogger,
  ) {}

  async execute(command: GetMeCommand): Promise<GetMeResult> {
    const user = await this.repo.findById(command.userId);

    if (user === null) {
      this.logger.error('User not found', { userId: command.userId });
      throw new UserNotFoundError(command.userId);
    }

    this.logger.info('User profile retrieved', { userId: user.id });

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
      statusId: user.statusId,
      roleId: user.roleId,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
