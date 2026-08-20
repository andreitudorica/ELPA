import FormControl from '@mui/material/FormControl';
import FormHelperText from '@mui/material/FormHelperText';
import FormLabel from '@mui/material/FormLabel';
import { type ReactNode } from 'react';

export interface FormFieldProps {
  label: string;
  /** id of the wrapped control, connected to the label. */
  htmlFor?: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  disabled?: boolean;
  children: ReactNode;
}

/**
 * Accessible wrapper for custom controls that are not covered by the dedicated
 * Form* adapters: renders a label, the control and helper/error text with the
 * right associations.
 */
export function FormField({
  label,
  htmlFor,
  error,
  helperText,
  required = false,
  disabled = false,
  children,
}: FormFieldProps) {
  const message = error ?? helperText;

  return (
    <FormControl error={error !== undefined} required={required} disabled={disabled} fullWidth>
      <FormLabel htmlFor={htmlFor} sx={{ mb: 1, typography: 'subtitle2' }}>
        {label}
      </FormLabel>
      {children}
      {message !== undefined && <FormHelperText sx={{ mx: 0 }}>{message}</FormHelperText>}
    </FormControl>
  );
}
