import { type Meta, type StoryObj } from '@storybook/react-vite';

import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';
import { LoadingState } from './LoadingState';

const meta = {
  title: 'Feedback/States',
} satisfies Meta;

export default meta;

export const Empty: StoryObj = {
  render: () => (
    <EmptyState title="No projects yet" description="Create your first project to get started." />
  ),
};

export const Error: StoryObj = {
  render: () => <ErrorState onRetry={() => undefined} />,
};

export const ErrorWithoutRetry: StoryObj = {
  render: () => (
    <ErrorState title="Users could not be loaded" description="Please try again later." />
  ),
};

export const Loading: StoryObj = {
  render: () => <LoadingState />,
};
