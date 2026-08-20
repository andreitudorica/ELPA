import { useRouter, type ErrorComponentProps } from '@tanstack/react-router';

import { ErrorState } from '@/components/feedback/ErrorState';

/** Default error boundary for routes: friendly message + retry via router invalidation. */
export function RouteErrorFallback({ error }: ErrorComponentProps) {
  const router = useRouter();

  return (
    <ErrorState
      error={error}
      onRetry={() => {
        void router.invalidate();
      }}
    />
  );
}
