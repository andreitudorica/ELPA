import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Link from '@mui/material/Link';
import ListItemButton from '@mui/material/ListItemButton';
import MenuItem from '@mui/material/MenuItem';
import { createLink, type LinkComponent } from '@tanstack/react-router';

/**
 * Material UI components wired to TanStack Router via `createLink`, giving
 * type-checked `to`/`params`/`search` props plus preloading on intent.
 * Always use these (never raw `<a>` or MUI `href`) for internal navigation.
 */

const CreatedLink = createLink(Link);
export const AppLink: LinkComponent<typeof Link> = (props) => (
  <CreatedLink preload="intent" {...props} />
);

const CreatedButtonLink = createLink(Button);
export const ButtonLink: LinkComponent<typeof Button> = (props) => (
  <CreatedButtonLink preload="intent" {...props} />
);

const CreatedIconButtonLink = createLink(IconButton);
export const IconButtonLink: LinkComponent<typeof IconButton> = (props) => (
  <CreatedIconButtonLink preload="intent" {...props} />
);

const CreatedListItemButtonLink = createLink(ListItemButton);
export const ListItemButtonLink: LinkComponent<typeof ListItemButton> = (props) => (
  <CreatedListItemButtonLink preload="intent" {...props} />
);

const CreatedMenuItemLink = createLink(MenuItem);
export const MenuItemLink: LinkComponent<typeof MenuItem> = (props) => (
  <CreatedMenuItemLink preload="intent" {...props} />
);
