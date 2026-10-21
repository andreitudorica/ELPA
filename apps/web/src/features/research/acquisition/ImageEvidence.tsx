import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { studio, type CandidateDetail } from '@/lib/apiClient';

type Evidence = CandidateDetail['evidence'][number];

export function ImageEvidence({
  item,
  claims,
  campaignId,
  candidateId,
}: {
  item: Evidence;
  claims: CandidateDetail['claims'];
  campaignId: string;
  candidateId: string;
}) {
  const { t } = useTranslation();
  const preview = useQuery({
    queryKey: ['visual-preview', campaignId, candidateId, item.id, item.image?.sha256],
    queryFn: ({ signal }) =>
      studio.acquisition.imagePreview(campaignId, candidateId, item.id, signal),
    enabled: item.image !== null,
  });
  const imageElement = useRef<HTMLImageElement>(null);
  useEffect(() => {
    if (preview.data === undefined || imageElement.current === null) return;
    const objectUrl = URL.createObjectURL(preview.data);
    imageElement.current.src = objectUrl;
    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [preview.data]);
  const image = item.image;
  if (image === null) return null;
  const observations = claims.filter(
    (claim) => claim.evidenceId === item.id && claim.visual !== null,
  );
  const relatedText = claims.filter((claim) => claim.target.startsWith('offer.'));
  return (
    <Stack spacing={1}>
      <Alert severity="warning">{t('acquisition.visual.pending')}</Alert>
      {preview.isError && <Alert severity="error">{t('acquisition.visual.previewError')}</Alert>}
      {preview.data !== undefined && (
        <Box sx={{ position: 'relative', width: 'fit-content', maxWidth: '100%' }}>
          <Box
            component="img"
            ref={imageElement}
            alt={t('acquisition.visual.previewAlt')}
            sx={{ maxWidth: '100%', display: 'block' }}
          />
          {observations.map((claim, index) => {
            const region = claim.visual?.region;
            return region === null || region === undefined ? null : (
              <Box
                key={claim.id}
                sx={{
                  position: 'absolute',
                  left: `${String(region.x * 100)}%`,
                  top: `${String(region.y * 100)}%`,
                  width: `${String(region.width * 100)}%`,
                  height: `${String(region.height * 100)}%`,
                  border: 2,
                  borderColor: 'warning.main',
                  color: 'common.white',
                  pointerEvents: 'none',
                }}
              >
                {index + 1}
              </Box>
            );
          })}
        </Box>
      )}
      <Typography variant="body2">{image.caption}</Typography>
      <Typography variant="caption">
        {t('acquisition.visual.context', {
          sourceContext: image.relationshipContext,
          captured: image.captureDate ?? '—',
          retrieved: image.retrievedAt,
        })}
      </Typography>
      <Typography variant="caption">
        {image.rights.credit} ·{' '}
        <Link href={image.rights.licenceUrl} target="_blank" rel="noreferrer">
          {image.rights.licence}
        </Link>{' '}
        ·{' '}
        <Link href={image.sourcePage} target="_blank" rel="noreferrer">
          {t('acquisition.candidate.openSource')}
        </Link>
      </Typography>
      <Typography variant="caption">{t('acquisition.visual.permission')}</Typography>
      {observations.length === 0 && (
        <Typography variant="body2">{t('acquisition.visual.noModel')}</Typography>
      )}
      {observations.map((claim, index) => (
        <Stack key={claim.id} spacing={0.5}>
          <Typography variant="subtitle2">
            {index + 1}. {claim.target} · {JSON.stringify(claim.value)}
          </Typography>
          <Typography variant="caption">
            {t('acquisition.visual.observation', {
              model: claim.visual?.model,
              version: claim.visual?.modelVersion,
              visibility: claim.visual?.visibility,
              attribution: claim.visual?.propertyAttribution,
              uncertainty: claim.visual?.uncertainty,
            })}
          </Typography>
          <Typography variant="caption">
            {claim.extractionMethod} · {claim.visual?.promptVersion} ·{' '}
            {claim.visual?.evaluationStatus}
          </Typography>
        </Stack>
      ))}
      <Typography variant="subtitle2">{t('acquisition.visual.textClaims')}</Typography>
      {relatedText.map((claim) => (
        <Typography variant="caption" key={claim.id}>
          {claim.target}: {JSON.stringify(claim.value)} · {claim.extractionMethod}
        </Typography>
      ))}
    </Stack>
  );
}
