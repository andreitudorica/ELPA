import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormHelperText from '@mui/material/FormHelperText';
import FormLabel from '@mui/material/FormLabel';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import { useId } from 'react';
import { useController, type Control, type FieldPath, type FieldValues } from 'react-hook-form';

export interface FormRadioOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface FormRadioGroupProps<TFieldValues extends FieldValues> {
  control: Control<TFieldValues>;
  name: FieldPath<TFieldValues>;
  label: string;
  options: readonly FormRadioOption[];
  helperText?: string;
  row?: boolean;
  disabled?: boolean;
}

export function FormRadioGroup<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  options,
  helperText,
  row = false,
  disabled,
}: FormRadioGroupProps<TFieldValues>) {
  const { field, fieldState } = useController({ control, name });
  const labelId = useId();

  return (
    <FormControl error={fieldState.error !== undefined} disabled={disabled ?? false}>
      <FormLabel id={labelId}>{label}</FormLabel>
      <RadioGroup
        aria-labelledby={labelId}
        row={row}
        name={field.name}
        value={field.value ?? ''}
        onChange={field.onChange}
        onBlur={field.onBlur}
      >
        {options.map((option) => (
          <FormControlLabel
            key={option.value}
            value={option.value}
            control={<Radio />}
            label={option.label}
            disabled={option.disabled ?? false}
          />
        ))}
      </RadioGroup>
      {(fieldState.error?.message ?? helperText) !== undefined && (
        <FormHelperText>{fieldState.error?.message ?? helperText}</FormHelperText>
      )}
    </FormControl>
  );
}
