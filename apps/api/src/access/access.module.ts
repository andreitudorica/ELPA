import { Global, Module } from '@nestjs/common';

import { ADMINISTRATOR_RESOLVER, AdministratorGuard } from '../common';
import { AccessController } from './access.controller';
import { AccessService } from './access.service';
import { AdministratorRepository } from './administrator.repository';

@Global()
@Module({
  controllers: [AccessController],
  providers: [
    AdministratorRepository,
    AccessService,
    AdministratorGuard,
    {
      provide: ADMINISTRATOR_RESOLVER,
      useExisting: AccessService,
    },
  ],
  exports: [ADMINISTRATOR_RESOLVER, AdministratorGuard, AccessService],
})
export class AccessModule {}
