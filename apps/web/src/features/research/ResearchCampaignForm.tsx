import { zodResolver } from '@hookform/resolvers/zod';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { AppButton } from '@/components/common/AppButton';
import { AppCard } from '@/components/common/AppCard';
import { FormTextField } from '@/components/forms/FormTextField';
import { applyServerErrors } from '@/components/forms/serverErrors';

import { useCreateResearchCampaign } from './api';

function splitLines(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function ResearchCampaignForm() {
  const { t } = useTranslation();
  const schema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(3, t('researchCampaigns.form.nameTooShort')).max(160),
        eventNeed: z.string().trim().min(1, t('researchCampaigns.form.required')).max(500),
        county: z.string().trim().min(2, t('researchCampaigns.form.countyTooShort')).max(100),
        locality: z.string().trim().max(200),
        minimumCriteria: z
          .string()
          .refine((value) => splitLines(value).length > 0, t('researchCampaigns.form.required')),
        investigatedSources: z
          .string()
          .refine((value) => splitLines(value).length > 0, t('researchCampaigns.form.required'))
          .refine(
            (value) => splitLines(value).every((url) => z.url().safeParse(url).success),
            t('researchCampaigns.form.invalidSource'),
          ),
      }),
    [t],
  );

  type FormValues = z.infer<typeof schema>;
  const defaultValues: FormValues = {
    name: '',
    eventNeed: '',
    county: '',
    locality: '',
    minimumCriteria: '',
    investigatedSources: '',
  };
  const {
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  const createCampaign = useCreateResearchCampaign({
    errorMessage: t('researchCampaigns.feedback.createError'),
    successMessage: t('researchCampaigns.feedback.created'),
  });

  const submit = handleSubmit((values) => {
    createCampaign.mutate(
      {
        name: values.name.trim(),
        eventNeed: values.eventNeed.trim(),
        county: values.county.trim(),
        ...(values.locality.trim().length > 0 ? { locality: values.locality.trim() } : {}),
        minimumCriteria: splitLines(values.minimumCriteria),
        investigatedSources: splitLines(values.investigatedSources),
      },
      {
        onSuccess: () => {
          reset(defaultValues);
        },
        onError: (error) => {
          const applied = applyServerErrors(error, setError, [
            'name',
            'eventNeed',
            'county',
            'locality',
            'minimumCriteria',
            'investigatedSources',
          ]);
          if (!applied) {
            setError('root.server', {
              type: 'server',
              message: t('researchCampaigns.feedback.createError'),
            });
          }
        },
      },
    );
  });

  return (
    <AppCard
      title={t('researchCampaigns.form.title')}
      subheader={t('researchCampaigns.form.description')}
    >
      <Stack component="form" spacing={2} onSubmit={submit} noValidate>
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
          <Chip label={t('researchCampaigns.category')} size="small" />
          <Chip label={t('researchCampaigns.country')} size="small" />
        </Stack>
        <FormTextField
          control={control}
          name="name"
          label={t('researchCampaigns.form.name')}
          autoComplete="off"
          required
        />
        <FormTextField
          control={control}
          name="eventNeed"
          label={t('researchCampaigns.form.eventNeed')}
          multiline
          minRows={3}
          required
        />
        <FormTextField
          control={control}
          name="county"
          label={t('researchCampaigns.form.county')}
          autoComplete="address-level1"
          required
        />
        <FormTextField
          control={control}
          name="locality"
          label={t('researchCampaigns.form.locality')}
          autoComplete="address-level2"
        />
        <FormTextField
          control={control}
          name="minimumCriteria"
          label={t('researchCampaigns.form.minimumCriteria')}
          helperText={t('researchCampaigns.form.onePerLine')}
          multiline
          minRows={3}
          required
        />
        <FormTextField
          control={control}
          name="investigatedSources"
          label={t('researchCampaigns.form.sources')}
          helperText={t('researchCampaigns.form.oneUrlPerLine')}
          multiline
          minRows={3}
          required
        />
        {errors.root?.server?.message !== undefined && (
          <Alert severity="error">{errors.root.server.message}</Alert>
        )}
        <Typography variant="caption" color="text.secondary">
          {t('researchCampaigns.form.auditNotice')}
        </Typography>
        <AppButton type="submit" loading={createCampaign.isPending}>
          {t('researchCampaigns.form.submit')}
        </AppButton>
      </Stack>
    </AppCard>
  );
}
