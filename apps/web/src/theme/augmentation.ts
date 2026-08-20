import { type CustomTokens } from './tokens';

declare module '@mui/material/styles' {
  interface Theme {
    custom: CustomTokens;
  }
  interface ThemeOptions {
    custom?: CustomTokens;
  }
}

export {};
