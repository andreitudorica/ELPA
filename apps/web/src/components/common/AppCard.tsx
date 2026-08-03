import Card, { type CardProps } from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import { type ReactNode } from 'react';

export interface AppCardProps extends Omit<CardProps, 'title'> {
  title?: ReactNode;
  subheader?: ReactNode;
  /** Action area in the card header (e.g. an icon button or menu). */
  headerAction?: ReactNode;
  /** Remove CardContent padding, e.g. when the card wraps a table. */
  disableContentPadding?: boolean;
}

/** Card with consistent header typography and content spacing. */
export function AppCard({
  title,
  subheader,
  headerAction,
  disableContentPadding = false,
  children,
  ...cardProps
}: AppCardProps) {
  return (
    <Card {...cardProps}>
      {(title !== undefined || subheader !== undefined) && (
        <CardHeader
          title={title}
          subheader={subheader}
          action={headerAction}
          slotProps={{
            title: { variant: 'h6' },
            subheader: { variant: 'body2' },
          }}
        />
      )}
      {disableContentPadding ? (
        children
      ) : (
        <CardContent sx={{ pt: title !== undefined ? 0 : undefined }}>{children}</CardContent>
      )}
    </Card>
  );
}
