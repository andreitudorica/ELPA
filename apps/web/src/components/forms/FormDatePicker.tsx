import { DatePicker, type DatePickerProps } from '@mui/x-date-pickers/DatePicker';
import { useController, type Control, type FieldPath, type FieldValues } from 'react-hook-form';

export interface FormDatePickerProps<TFieldValues extends FieldValues> extends Omit<
  DatePickerProps,
  'value' | 'onChange' | 'name' | 'defaultValue' | 'inputRef'
> {
  control: Control<TFieldValues>;
  name: FieldPath<TFieldValues>;
  helperText?: string;
}

/**
 * MUI X DatePicker (community edition) bound to React Hook Form.
 * The field value is a `Date | null`; locale comes from LocalizationProvider.
 */
export function FormDatePicker<TFieldValues extends FieldValues>({
  control,
  name,
  helperText,
  disabled,
  slotProps,
  ...rest
}: FormDatePickerProps<TFieldValues>) {
  const { field, fieldState } = useController({ control, name });

  return (
    <DatePicker
      {...rest}
      name={field.name}
      value={field.value ?? null}
      onChange={(value) => {
        field.onChange(value);
      }}
      inputRef={field.ref}
      disabled={disabled ?? field.disabled ?? false}
      slotProps={{
        ...slotProps,
        // The textField slot is managed by this adapter (error/helper wiring).
        textField: {
          fullWidth: true,
          onBlur: field.onBlur,
          error: fieldState.error !== undefined,
          helperText: fieldState.error?.message ?? helperText,
        },
      }}
    />
  );
}
