import Button, { type ButtonProps } from '@mui/material/Button';

export type AppButtonProps = ButtonProps;

/**
 * Application button convention: contained by default, supports the `loading`
 * prop (spinner + disabled + preserved width) for async actions.
 */
export function AppButton({ variant = 'contained', ...props }: AppButtonProps) {
  return <Button variant={variant} {...props} />;
}
