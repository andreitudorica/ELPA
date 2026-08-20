import AddIcon from '@mui/icons-material/Add';
import Stack from '@mui/material/Stack';
import { type Meta, type StoryObj } from '@storybook/react-vite';

import { AppButton } from './AppButton';

const meta = {
  title: 'Common/AppButton',
  component: AppButton,
  args: { children: 'Save changes' },
} satisfies Meta<typeof AppButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Variants: Story = {
  render: (args) => (
    <Stack direction="row" spacing={2}>
      <AppButton {...args} />
      <AppButton {...args} variant="outlined" />
      <AppButton {...args} variant="text" />
      <AppButton {...args} color="error">
        Delete
      </AppButton>
      <AppButton {...args} startIcon={<AddIcon />}>
        Add user
      </AppButton>
    </Stack>
  ),
};

export const Loading: Story = {
  args: { loading: true },
};

export const Disabled: Story = {
  args: { disabled: true },
};

export const LongContent: Story = {
  args: {
    children: 'A very long call to action that should not break the button layout',
  },
};
