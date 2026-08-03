import { useController, type Control, type FieldPath, type FieldValues } from 'react-hook-form';

import { AppCheckbox, type AppCheckboxProps } from '../common/AppCheckbox';

export interface FormCheckboxProps<TFieldValues extends FieldValues> extends Omit<
  AppCheckboxProps,
  'name' | 'checked' | 'onChange' | 'onBlur' | 'error'
> {
  control: Control<TFieldValues>;
  name: FieldPath<TFieldValues>;
}

export function FormCheckbox<TFieldValues extends FieldValues>({
  control,
  name,
  helperText,
  disabled,
  ...rest
}: FormCheckboxProps<TFieldValues>) {
  const { field, fieldState } = useController({ control, name });

  return (
    <AppCheckbox
      {...rest}
      name={field.name}
      checked={field.value ?? false}
      onChange={field.onChange}
      onBlur={field.onBlur}
      disabled={disabled ?? field.disabled ?? false}
      error={fieldState.error !== undefined}
      helperText={fieldState.error?.message ?? helperText}
    />
  );
}
