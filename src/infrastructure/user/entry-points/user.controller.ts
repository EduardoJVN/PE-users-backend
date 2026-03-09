import { BaseController } from '@infra/entry-points/base.controller.js';
import type { HttpRequest, HttpResponse } from '@infra/entry-points/base.controller.js';
import type { GetMeUseCase } from '@application/user/use-cases/get-me.use-case.js';

export class UserController extends BaseController {
  constructor(private readonly getMeUseCase: GetMeUseCase) {
    super();
  }

  async getMe(req: HttpRequest): Promise<HttpResponse> {
    if (!req.userId) {
      return { status: 401, body: { error: 'Unauthorized' } };
    }

    return this.handleRequest(
      () => this.getMeUseCase.execute({ userId: req.userId as string }),
      (result) => ({ status: 200, body: result }),
      (error) => ({ status: error.status, body: { error: error.message } }),
    );
  }
}
