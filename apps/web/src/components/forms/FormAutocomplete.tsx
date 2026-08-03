import Autocomplete from '@mui/material/Autocomplete';
import { useController, type Control, type FieldPath, type FieldValues } from 'react-hook-form';

import { AppTextField } from '../common/AppTextField';

export interface FormAutocompleteProps<TFieldValues extends FieldValues> {
  control: Control<TFieldValues>;
  name: FieldPath<TFieldValues>;
  label: string;
  options: readonly string[];
  /** Multiple selection stores `string[]`; single stores `string | null`. */
  multiple?: boolean;
  /** Allow values that are not in `options`. */
  freeSolo?: boolean;
  helperText?: string;
  placeholder?: string;
  disabled?: boolean;
}

export function FormAutocomplete<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  options,
  multiple = false,
  freeSolo = false,
  helperText,
  placeholder,
  disabled,
}: FormAutocompleteProps<TFieldValues>) {
  const { field, fieldState } = useController({ control, name });

  const value = multiple
    ? ((field.value as string[] | undefined) ?? [])
    : ((field.value as string | null | undefined) ?? null);

  return (
    <Autocomplete
      multiple={multiple}
      freeSolo={freeSolo}
      options={options}
      value={value}
      onChange={(_event, nextValue) => {
        field.onChange(nextValue);
      }}
      onBlur={field.onBlur}
      disabled={disabled ?? field.disabled ?? false}
      autoHighlight
      renderInput={(params) => (
        <AppTextField
          {...params}
          label={label}
          name={field.name}
          inputRef={field.ref}
          placeholder={placeholder}
          error={fieldState.error !== undefined}
          helperText={fieldState.error?.message ?? helperText}
        />
      )}
    />
  );
}
