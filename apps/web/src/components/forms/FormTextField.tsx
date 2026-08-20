import { useController, type Control, type FieldPath, type FieldValues } from 'react-hook-form';

import { AppTextField, type AppTextFieldProps } from '../common/AppTextField';

export interface FormTextFieldProps<TFieldValues extends FieldValues> extends Omit<
  AppTextFieldProps,
  'name' | 'value' | 'defaultValue' | 'onChange' | 'onBlur' | 'error' | 'inputRef'
> {
  control: Control<TFieldValues>;
  name: FieldPath<TFieldValues>;
}

/**
 * React Hook Form adapter for text inputs. Field errors (client- or
 * server-side, see applyServerErrors) replace the helper text automatically.
 */
export function FormTextField<TFieldValues extends FieldValues>({
  control,
  name,
  helperText,
  disabled,
  ...rest
}: FormTextFieldProps<TFieldValues>) {
  const { field, fieldState } = useController({ control, name });

  return (
    <AppTextField
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
