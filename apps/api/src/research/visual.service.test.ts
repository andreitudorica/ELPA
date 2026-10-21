import 'reflect-metadata';

import { GUARDS_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import { ClsService } from 'nestjs-cls';
import { describe, expect, it, vi } from 'vitest';

import { AuditRepository } from '../audit';
import { AdministratorGuard } from '../common';
import { UnitOfWork } from '../database';
import { AcquisitionController } from './acquisition.controller';
import { AcquisitionRepository } from './acquisition.repository';
import { AcquisitionQueryRepository } from './acquisition-query.repository';
import { ResearchCampaignRepository } from './research-campaign.repository';
import { VisualRepository } from './visual.repository';
import { VisualService } from './visual.service';

describe('protected visual inspection', () => {
  it('keeps preview requests under the existing Administrator controller and guard', () => {
    expect(Reflect.getMetadata(PATH_METADATA, AcquisitionController)).toBe(
      'admin/research-campaigns',
    );
    expect(Reflect.getMetadata(GUARDS_METADATA, AcquisitionController)).toContain(
      AdministratorGuard,
    );
  });

  it('checks the campaign/Candidate/Evidence relationship before reading any retained image', async () => {
    const linked = vi.fn<VisualRepository['linked']>().mockResolvedValue(undefined);
    const module = await Test.createTestingModule({
      providers: [
        VisualService,
        { provide: VisualRepository, useValue: { linked } },
        ...[
          AcquisitionRepository,
          AcquisitionQueryRepository,
          ResearchCampaignRepository,
          AuditRepository,
          UnitOfWork,
          ClsService,
        ].map((provide) => ({ provide, useValue: {} })),
      ],
    }).compile();
    const service = module.get(VisualService);
    await expect(service.preview('wrong-campaign', 'candidate', 'evidence')).rejects.toThrow(
      'Authorized image Evidence not found',
    );
    expect(linked).toHaveBeenCalledWith('wrong-campaign', 'candidate', 'evidence');
    linked.mockResolvedValue({
      payload: { kind: 'authorized_image@1', imageUrl: 'https://example.com/untrusted' },
      contentSha256: 'wrong',
      artifactId: 'artifact',
    });
    await expect(service.preview('campaign', 'candidate', 'evidence')).rejects.toThrow(
      'Authorized image Evidence not found',
    );
    await module.close();
  });
});
