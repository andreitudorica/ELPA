import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import MenuIcon from '@mui/icons-material/Menu';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import { useTheme } from '@mui/material/styles';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { useUiStore } from '@/app/store/uiStore';

import { SidebarNav, type SidebarNavItem } from '../navigation/SidebarNav';

import { SkipLink } from './SkipLink';

export interface AppShellProps {
  appName: string;
  navItems: readonly SidebarNavItem[];
  /** Right side of the header: switchers, notifications, user menu. */
  headerActions?: ReactNode;
  /** Rendered above the page content, typically <AppBreadcrumbs />. */
  breadcrumbs?: ReactNode;
  children: ReactNode;
}

/**
 * Responsive application frame: fixed header, permanent collapsible sidebar on
 * desktop, temporary drawer on mobile, skip link and a labelled main landmark.
 */
export function AppShell({
  appName,
  navItems,
  headerActions,
  breadcrumbs,
  children,
}: AppShellProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));

  const sidebarCollapsed = useUiStore((state) => state.sidebarCollapsed);
  const mobileNavOpen = useUiStore((state) => state.mobileNavOpen);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  const setMobileNavOpen = useUiStore((state) => state.setMobileNavOpen);

  const { headerHeight, sidebarWidth, sidebarCollapsedWidth } = theme.custom.layout;
  const drawerWidth = sidebarCollapsed ? sidebarCollapsedWidth : sidebarWidth;

  const brand = (
    <Toolbar sx={{ minHeight: headerHeight, px: 2 }}>
      <Typography variant="h6" component="span" noWrap sx={{ fontWeight: 700 }}>
        {sidebarCollapsed && isDesktop ? appName.charAt(0) : appName}
      </Typography>
    </Toolbar>
  );

  const navigation = (
    <SidebarNav
      items={navItems}
      collapsed={isDesktop && sidebarCollapsed}
      onNavigate={() => {
        setMobileNavOpen(false);
      }}
    />
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <SkipLink />

      <AppBar
        position="fixed"
        sx={{
          zIndex: theme.zIndex.drawer + 1,
          bgcolor: 'background.paper',
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Toolbar sx={{ minHeight: headerHeight, gap: 1 }}>
          {!isDesktop && (
            <IconButton
              aria-label={t('navigation.openMenu')}
              edge="start"
              onClick={() => {
                setMobileNavOpen(true);
              }}
            >
              <MenuIcon />
            </IconButton>
          )}
          <Typography variant="h6" component="span" sx={{ fontWeight: 700 }}>
            {appName}
          </Typography>
          <Box sx={{ flexGrow: 1 }} />
          <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
            {headerActions}
          </Stack>
        </Toolbar>
      </AppBar>

      {isDesktop ? (
        <Drawer
          variant="permanent"
          sx={{
            width: drawerWidth,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: drawerWidth,
              boxSizing: 'border-box',
              borderRight: 1,
              borderColor: 'divider',
              transition: theme.transitions.create('width'),
              overflowX: 'hidden',
            },
          }}
        >
          <Toolbar sx={{ minHeight: headerHeight }} />
          <Box sx={{ flexGrow: 1, overflowY: 'auto' }}>{navigation}</Box>
          <Divider />
          <Box
            sx={{ display: 'flex', justifyContent: sidebarCollapsed ? 'center' : 'flex-end', p: 1 }}
          >
            <IconButton
              aria-label={
                sidebarCollapsed ? t('navigation.expandSidebar') : t('navigation.collapseSidebar')
              }
              onClick={toggleSidebar}
              size="small"
            >
              {sidebarCollapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
            </IconButton>
          </Box>
        </Drawer>
      ) : (
        <Drawer
          variant="temporary"
          open={mobileNavOpen}
          onClose={() => {
            setMobileNavOpen(false);
          }}
          ModalProps={{ keepMounted: true }}
          sx={{ '& .MuiDrawer-paper': { width: sidebarWidth, boxSizing: 'border-box' } }}
        >
          {brand}
          <Divider />
          {navigation}
        </Drawer>
      )}

      <Box
        component="main"
        id="main-content"
        tabIndex={-1}
        sx={{
          flexGrow: 1,
          minWidth: 0,
          px: { xs: 2, sm: 3 },
          py: 3,
          mt: `${headerHeight}px`,
          outline: 'none',
        }}
      >
        {breadcrumbs !== undefined && <Box sx={{ mb: 2 }}>{breadcrumbs}</Box>}
        {children}
      </Box>
    </Box>
  );
}
