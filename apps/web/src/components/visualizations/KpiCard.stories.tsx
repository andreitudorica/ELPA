import Grid from '@mui/material/Grid';
import { type Meta, type StoryObj } from '@storybook/react-vite';

import { KpiCard } from './KpiCard';

const meta = {
  title: 'Visualizations/KpiCard',
  component: KpiCard,
  args: {
    label: 'Active users',
    value: '8.4K',
    delta: 0.038,
    deltaLabel: 'vs. previous period',
    sparklineData: [310, 335, 320, 360, 358, 390, 410, 405, 430, 460],
  },
} satisfies Meta<typeof KpiCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const NegativeTrend: Story = {
  args: { label: 'New signups', value: '1,284', delta: -0.014 },
};

export const Loading: Story = {
  args: { loading: true },
};

export const Dashboard: Story = {
  render: (args) => (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
        <KpiCard {...args} />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
        <KpiCard label="Total users" value="12.6K" delta={0.062} deltaLabel="vs. previous period" />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
        <KpiCard
          label="New signups"
          value="1,284"
          delta={-0.014}
          deltaLabel="vs. previous period"
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
        <KpiCard
          label="Conversion rate"
          value="18.4%"
          delta={0.021}
          deltaLabel="vs. previous period"
        />
      </Grid>
    </Grid>
  ),
};
