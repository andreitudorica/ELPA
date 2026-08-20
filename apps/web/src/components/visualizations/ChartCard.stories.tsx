import { useTheme } from '@mui/material/styles';
import { BarChart } from '@mui/x-charts/BarChart';
import { type Meta, type StoryObj } from '@storybook/react-vite';

import { ChartCard } from './ChartCard';

function DemoChart() {
  const theme = useTheme();
  return (
    <BarChart
      xAxis={[{ data: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], scaleType: 'band' }]}
      series={[
        {
          data: [5230, 5890, 6120, 5760, 4980],
          label: 'Active users',
          color: theme.palette.primary.main,
        },
      ]}
      borderRadius={4}
      hideLegend
    />
  );
}

const meta = {
  title: 'Visualizations/ChartCard',
  component: ChartCard,
  args: {
    title: 'Weekly activity',
    description: 'Active users per weekday',
    children: <DemoChart />,
  },
} satisfies Meta<typeof ChartCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Loading: Story = {
  args: { loading: true },
};

export const Empty: Story = {
  args: { empty: true },
};

export const ErrorCard: Story = {
  name: 'Error',
  args: { error: new Error('Request failed'), onRetry: () => undefined },
};
