import TextField, { type TextFieldProps } from '@mui/material/TextField';

export type AppTextFieldProps = TextFieldProps;

/**
 * Application text field convention: outlined, small, full width. The label is
 * always rendered by MUI as a real `<label>` associated with the input.
 */
export function AppTextField({ fullWidth = true, ...props }: AppTextFieldProps) {
  return <TextField fullWidth={fullWidth} {...props} />;
}
