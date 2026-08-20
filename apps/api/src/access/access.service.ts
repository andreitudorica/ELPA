import { Injectable } from '@nestjs/common';

import {
  type AdministratorIdentity,
  type AdministratorResolver,
  AuthenticationError,
  AuthorizationError,
} from '../common';
import { loadEnv } from '../config/env';
import { AdministratorRepository } from './administrator.repository';

@Injectable()
export class AccessService implements AdministratorResolver {
  constructor(private readonly administrators: AdministratorRepository) {}

  async resolveCurrentAdministrator(): Promise<AdministratorIdentity> {
    const email = loadEnv().API_SIMULATED_ADMINISTRATOR_EMAIL;
    if (email === undefined) {
      throw new AuthenticationError('No administrator identity is configured');
    }

    const administrator = await this.administrators.findByEmail(email);
    if (administrator === undefined) {
      throw new AuthorizationError(`The configured identity ${email} is not an ELPA Administrator`);
    }

    return administrator;
  }

  async findAdministratorsByIds(ids: string[]): Promise<AdministratorIdentity[]> {
    return this.administrators.findByIds([...new Set(ids)]);
  }
}
