import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormHelperText from '@mui/material/FormHelperText';
import Switch from '@mui/material/Switch';
import { type ReactNode } from 'react';
import { useController, type Control, type FieldPath, type FieldValues } from 'react-hook-form';

export interface FormSwitchProps<TFieldValues extends FieldValues> {
  control: Control<TFieldValues>;
  name: FieldPath<TFieldValues>;
  label: ReactNode;
  helperText?: string | undefined;
  disabled?: boolean | undefined;
}

export function FormSwitch<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  helperText,
  disabled,
}: FormSwitchProps<TFieldValues>) {
  const { field, fieldState } = useController({ control, name });

  return (
    <FormControl error={fieldState.error !== undefined}>
      <FormControlLabel
        control={
          <Switch
            name={field.name}
            checked={field.value ?? false}
            onChange={field.onChange}
            onBlur={field.onBlur}
            disabled={disabled ?? field.disabled ?? false}
          />
        }
        label={label}
      />
      {(fieldState.error?.message ?? helperText) !== undefined && (
        <FormHelperText>{fieldState.error?.message ?? helperText}</FormHelperText>
      )}
    </FormControl>
  );
}
