import MenuItem from '@mui/material/MenuItem';
import TextField, { type TextFieldProps } from '@mui/material/TextField';

export interface AppSelectOption<TValue extends string = string> {
  value: TValue;
  label: string;
  disabled?: boolean;
}

export type AppSelectProps<TValue extends string = string> = Omit<
  TextFieldProps,
  'select' | 'children'
> & {
  options: readonly AppSelectOption<TValue>[];
};

/**
 * Select built on MUI's `TextField select` so label, helper text and error
 * handling behave exactly like every other form field.
 */
export function AppSelect<TValue extends string = string>({
  options,
  fullWidth = true,
  ...props
}: AppSelectProps<TValue>) {
  return (
    <TextField select fullWidth={fullWidth} {...props}>
      {options.map((option) => (
        <MenuItem key={option.value} value={option.value} disabled={option.disabled ?? false}>
          {option.label}
        </MenuItem>
      ))}
    </TextField>
  );
}
