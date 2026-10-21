import { screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { studio, type CandidateDetail } from '@/lib/apiClient';
import { renderWithProviders } from '@/test/testUtils';

import { ImageEvidence } from './ImageEvidence';

const time = '2026-10-21T12:00:00Z';
const item: CandidateDetail['evidence'][number] = {
  id: 'synthetic-image-evidence',
  sourceRecordKey: 'File:Synthetic.jpg',
  sourceRecordUrl: null,
  contentSha256: 'synthetic',
  payload: {},
  redactedFields: [],
  observedAt: time,
  datasetVersion: 'synthetic@1',
  artifactSha256: 'synthetic',
  latest: false,
  image: {
    kind: 'authorized_image@1',
    title: 'File:Synthetic.jpg',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:Synthetic.jpg',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/synthetic.jpg',
    sourceVersion: 'synthetic@1',
    sourceSha1: 'a'.repeat(40),
    sha256: 'b'.repeat(64),
    byteSize: 100,
    width: 200,
    height: 100,
    format: 'jpeg',
    dHash: '0000000000000000',
    previewSha256: 'c'.repeat(64),
    processingVersion: 'grp-image-integrity@1',
    retrievedAt: time,
    captureDate: null,
    caption: 'Synthetic source caption',
    relationshipContext: 'Synthetic unreviewed link',
    relationship: 'source_tag_reference',
    attributionReview: 'unreviewed',
    privacyReview: 'not_cleared_for_external_processing',
    rights: {
      access: true,
      download: true,
      retain: true,
      localAnalysis: true,
      thirdPartyAnalysis: 'requires_explicit_authorization',
      publication: 'not_authorized_by_experiment',
      licence: 'CC BY-SA 4.0',
      licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
      credit: 'Synthetic author',
      permissionSource: 'https://commons.wikimedia.org/wiki/File:Synthetic.jpg',
      checkedAt: time,
    },
  },
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('authorized image inspection', () => {
  it('loads a protected local preview, keeps attribution pending, shows licence and does not hotlink the original', async () => {
    const create = vi.fn(() => 'blob:synthetic-preview');
    const revoke = vi.fn();
    vi.stubGlobal(
      'URL',
      class extends URL {
        static override createObjectURL = create;
        static override revokeObjectURL = revoke;
      },
    );
    vi.spyOn(studio.acquisition, 'imagePreview').mockResolvedValue(
      new Blob(['synthetic'], { type: 'image/png' }),
    );
    const view = renderWithProviders(
      <ImageEvidence item={item} claims={[]} campaignId="campaign" candidateId="candidate" />,
    );
    await waitFor(() =>
      expect(screen.getByRole('img')).toHaveAttribute('src', 'blob:synthetic-preview'),
    );
    expect(studio.acquisition.imagePreview).toHaveBeenCalledWith(
      'campaign',
      'candidate',
      item.id,
      expect.any(AbortSignal),
    );
    expect(screen.getByText(/image-to-property association is unreviewed/)).toBeVisible();
    expect(screen.getByRole('link', { name: 'CC BY-SA 4.0' })).toHaveAttribute(
      'href',
      'https://creativecommons.org/licenses/by-sa/4.0/',
    );
    expect(screen.getByText(/Visual AI analysis has not been executed/)).toBeVisible();
    expect(screen.getByRole('img')).not.toHaveAttribute('src', item.image?.imageUrl);
    expect(screen.queryByRole('button', { name: /verify|publish/i })).not.toBeInTheDocument();
    view.unmount();
    expect(revoke).toHaveBeenCalledWith('blob:synthetic-preview');
  });
});
