import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';

import { AccessService } from './access.service';
import { AdministratorDto } from './dto/administrator.dto';

@ApiTags('identity')
@Controller('me')
export class AccessController {
  constructor(private readonly access: AccessService) {}

  @Get()
  @ZodResponse({
    status: 200,
    type: AdministratorDto,
    description: 'The resolved ELPA Administrator for this request.',
  })
  getCurrentAdministrator(): Promise<AdministratorDto> {
    return this.access.resolveCurrentAdministrator();
  }
}
