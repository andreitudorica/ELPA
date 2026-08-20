import { zodResolver } from '@hookform/resolvers/zod';
import Stack from '@mui/material/Stack';
import { type Meta, type StoryObj } from '@storybook/react-vite';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { AppButton } from '../common/AppButton';

import { FormTextField } from './FormTextField';

const schema = z.object({
  email: z.string().min(1, 'This field is required.').pipe(z.email('Enter a valid email address.')),
});

type FormValues = z.infer<typeof schema>;

function DemoForm({ disabled = false }: { disabled?: boolean }) {
  const { control, handleSubmit } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  });

  return (
    <form
      onSubmit={(event) => {
        void handleSubmit(() => undefined)(event);
      }}
      noValidate
    >
      <Stack spacing={2} sx={{ maxWidth: 360 }}>
        <FormTextField
          control={control}
          name="email"
          label="Email address"
          helperText="We never share your email."
          disabled={disabled}
        />
        <AppButton type="submit">Submit</AppButton>
      </Stack>
    </form>
  );
}

const meta = {
  title: 'Forms/FormTextField',
  component: DemoForm,
  parameters: {
    docs: {
      description: {
        component:
          'React Hook Form adapter around AppTextField. Submit with an empty or invalid value to see the Zod validation message replace the helper text.',
      },
    },
  },
} satisfies Meta<typeof DemoForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Disabled: Story = {
  args: { disabled: true },
};
