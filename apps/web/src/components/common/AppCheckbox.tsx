import Checkbox, { type CheckboxProps } from '@mui/material/Checkbox';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormHelperText from '@mui/material/FormHelperText';
import { type ReactNode } from 'react';

export interface AppCheckboxProps extends Omit<CheckboxProps, 'children'> {
  label: ReactNode;
  helperText?: string | undefined;
  error?: boolean | undefined;
}

/** Checkbox with an associated label and accessible helper/error text. */
export function AppCheckbox({ label, helperText, error = false, ...props }: AppCheckboxProps) {
  return (
    <FormControl error={error}>
      <FormControlLabel control={<Checkbox {...props} />} label={label} />
      {helperText !== undefined && <FormHelperText>{helperText}</FormHelperText>}
    </FormControl>
  );
}
