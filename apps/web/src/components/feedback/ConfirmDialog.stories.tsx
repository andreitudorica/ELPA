import { type Meta, type StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';

import { ConfirmDialog } from './ConfirmDialog';

const meta = {
  title: 'Feedback/ConfirmDialog',
  component: ConfirmDialog,
  args: {
    open: true,
    title: 'Delete user?',
    description: 'This will permanently remove Ada Lovelace. This action cannot be undone.',
    confirmLabel: 'Delete user',
    onConfirm: fn(),
    onCancel: fn(),
  },
} satisfies Meta<typeof ConfirmDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Danger: Story = {
  args: { severity: 'danger' },
  // Interaction test: the dialog is labelled, and confirming fires the callback.
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    const dialog = await body.findByRole('dialog', { name: 'Delete user?' });
    await expect(dialog).toBeVisible();

    await userEvent.click(body.getByRole('button', { name: 'Delete user' }));
    await expect(args.onConfirm).toHaveBeenCalledTimes(1);

    await userEvent.click(body.getByRole('button', { name: 'Cancel' }));
    await expect(args.onCancel).toHaveBeenCalledTimes(1);
  },
};

export const Default: Story = {};

export const Loading: Story = {
  args: { severity: 'danger', loading: true },
};
