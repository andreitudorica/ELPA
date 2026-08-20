import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import PeopleOutlinedIcon from '@mui/icons-material/PeopleOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import Typography from '@mui/material/Typography';
import { type Meta, type StoryObj } from '@storybook/react-vite';

import { AppShell } from './AppShell';
import { PageHeader } from './PageHeader';

const navItems = [
  { key: 'dashboard', label: 'Dashboard', icon: <DashboardOutlinedIcon />, to: '/' },
  { key: 'users', label: 'Users', icon: <PeopleOutlinedIcon />, to: '/' },
  { key: 'settings', label: 'Settings', icon: <SettingsOutlinedIcon />, to: '/' },
];

const meta = {
  title: 'Layout/AppShell',
  component: AppShell,
  parameters: { layout: 'fullscreen' },
  args: {
    appName: 'Acme Console',
    navItems,
    children: (
      <>
        <PageHeader title="Dashboard" description="Overview of workspace activity." />
        <Typography variant="body2">Page content goes here.</Typography>
      </>
    ),
  },
} satisfies Meta<typeof AppShell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Desktop: Story = {};

export const Mobile: Story = {
  globals: {
    viewport: { value: 'mobile1' },
  },
};
