import { useBlocker } from '@tanstack/react-router';

export interface DirtyBlocker {
  /** True while navigation is paused waiting for the user's decision. */
  dialogOpen: boolean;
  /** Leave the page, discarding changes. */
  confirmLeave: () => void;
  /** Stay on the page. */
  stay: () => void;
}

/**
 * Blocks in-app navigation (and browser unload) while `dirty` is true, so a
 * confirmation dialog can be shown. Pair with <ConfirmDialog>.
 */
export function useDirtyBlocker(dirty: boolean): DirtyBlocker {
  const blocker = useBlocker({
    shouldBlockFn: () => dirty,
    disabled: !dirty,
    enableBeforeUnload: () => dirty,
    withResolver: true,
  });

  return {
    dialogOpen: blocker.status === 'blocked',
    confirmLeave: () => {
      if (blocker.status === 'blocked') {
        blocker.proceed();
      }
    },
    stay: () => {
      if (blocker.status === 'blocked') {
        blocker.reset();
      }
    },
  };
}
