import { useController, type Control, type FieldPath, type FieldValues } from 'react-hook-form';

import { AppSelect, type AppSelectProps } from '../common/AppSelect';

export interface FormSelectProps<TFieldValues extends FieldValues> extends Omit<
  AppSelectProps,
  'name' | 'value' | 'defaultValue' | 'onChange' | 'onBlur' | 'error' | 'inputRef'
> {
  control: Control<TFieldValues>;
  name: FieldPath<TFieldValues>;
}

export function FormSelect<TFieldValues extends FieldValues>({
  control,
  name,
  helperText,
  disabled,
  ...rest
}: FormSelectProps<TFieldValues>) {
  const { field, fieldState } = useController({ control, name });

  return (
    <AppSelect
      {...rest}
      name={field.name}
      value={field.value ?? ''}
      onChange={field.onChange}
      onBlur={field.onBlur}
      inputRef={field.ref}
      disabled={disabled ?? field.disabled ?? false}
      error={fieldState.error !== undefined}
      helperText={fieldState.error?.message ?? helperText}
    />
  );
}
