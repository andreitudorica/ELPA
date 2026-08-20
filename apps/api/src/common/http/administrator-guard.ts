import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Inject, Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';

import type { AppClsStore } from '../context/cls';
import { ADMINISTRATOR_RESOLVER, type AdministratorResolver } from './administrator-resolver';

/**
 * Resolves identity through the Access-owned port for every administrative
 * request and attaches the result to the shared request context. The guard
 * stays independent of simulated/OIDC details and of persistence.
 */
@Injectable()
export class AdministratorGuard implements CanActivate {
  constructor(
    @Inject(ADMINISTRATOR_RESOLVER)
    private readonly resolver: AdministratorResolver,
    private readonly cls: ClsService<AppClsStore>,
  ) {}

  async canActivate(_context: ExecutionContext): Promise<boolean> {
    const administrator = await this.resolver.resolveCurrentAdministrator();
    this.cls.set('administrator', administrator);
    return true;
  }
}
