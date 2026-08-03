import UploadFileIcon from '@mui/icons-material/UploadFile';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useId } from 'react';
import { useController, type Control, type FieldPath, type FieldValues } from 'react-hook-form';

import { FormField } from './FormField';

export interface FormFileInputProps<TFieldValues extends FieldValues> {
  control: Control<TFieldValues>;
  name: FieldPath<TFieldValues>;
  label: string;
  buttonLabel: string;
  /** `accept` attribute, e.g. "image/*". */
  accept?: string;
  helperText?: string;
  disabled?: boolean;
}

/**
 * File input bound to React Hook Form; the field value is `File | null`.
 * Pair with `api.upload(...)` on submit for the upload itself.
 */
export function FormFileInput<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  buttonLabel,
  accept,
  helperText,
  disabled,
}: FormFileInputProps<TFieldValues>) {
  const { field, fieldState } = useController({ control, name });
  const inputId = useId();
  const file = field.value as File | null | undefined;
  const isDisabled = disabled ?? field.disabled ?? false;

  return (
    <FormField
      label={label}
      htmlFor={inputId}
      {...(fieldState.error?.message !== undefined ? { error: fieldState.error.message } : {})}
      {...(helperText !== undefined ? { helperText } : {})}
      disabled={isDisabled}
    >
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
        <Button
          component="label"
          htmlFor={inputId}
          variant="outlined"
          startIcon={<UploadFileIcon />}
          disabled={isDisabled}
        >
          {buttonLabel}
          <input
            id={inputId}
            type="file"
            hidden
            {...(accept !== undefined ? { accept } : {})}
            ref={(element) => {
              field.ref(element);
            }}
            onBlur={field.onBlur}
            onChange={(event) => {
              field.onChange(event.target.files?.[0] ?? null);
              // Allow re-selecting the same file after clearing.
              event.target.value = '';
            }}
          />
        </Button>
        <Typography variant="body2" color={file ? 'text.primary' : 'text.secondary'}>
          {file ? file.name : '—'}
        </Typography>
      </Stack>
    </FormField>
  );
}
