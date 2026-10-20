/**
 * Normalisation of public web identifiers used as matching signals.
 *
 * A shared business domain is evidence about the Provider, not about a single
 * property: one operator may run several properties from one website. Shared
 * platform URLs (Facebook, Booking, ...) identify a page on someone else's
 * domain, so only the full normalised URL is comparable for them.
 */

/** Listing platforms, directories, social networks, and site builders observed in the sources. */
const PLATFORM_DOMAINS = new Set([
  'airbnb.com',
  'airbnb.ro',
  'alegecazare.ro',
  'blogspot.com',
  'booking.com',
  'business.site',
  'cazare7.ro',
  'cylex.ro',
  'facebook.com',
  'fb.com',
  'fb.me',
  'goo.gl',
  'google.com',
  'hotelmix.ro',
  'instagram.com',
  'lapensiuni.ro',
  'linktr.ee',
  'rezervari-camere.ro',
  'roturistic.ro',
  'skytrip.ro',
  'tiktok.com',
  'travelminit.ro',
  'tripadvisor.com',
  'tripadvisor.ro',
  'turistinfo.ro',
  'weebly.com',
  'wixsite.com',
  'wordpress.com',
  'youtube.com',
]);

/**
 * Free-mail providers, matched on the first label of the registrable domain so
 * every country variant (`yahoo.de`, `hotmail.it`, ...) is covered.
 */
const FREE_MAIL_PROVIDERS = new Set([
  'abv',
  'aol',
  'citromail',
  'clicknet',
  'email',
  'free',
  'freemail',
  'gmail',
  'gmx',
  'googlemail',
  'home',
  'hotmail',
  'icloud',
  'inbox',
  'libero',
  'live',
  'mac',
  'mail',
  'me',
  'msn',
  'o2',
  'orange',
  'outlook',
  'proton',
  'protonmail',
  'rdslink',
  'rocketmail',
  'seznam',
  't-online',
  'tiscali',
  'virgilio',
  'wanadoo',
  'web',
  'wp',
  'yahoo',
  'yandex',
  'ymail',
  'zoho',
]);

const SECOND_LEVEL_SUFFIXES = new Set(['co.uk', 'com.ro', 'info.ro', 'net.ro', 'org.ro']);

export interface NormalizedWebsite {
  url: string;
  host: string;
  /** Registrable domain, e.g. `pensiune.ro`. */
  domain: string;
  /** True when the domain is a shared platform rather than the operator's own. */
  platform: boolean;
  /** Comparison key: domain for own sites, host + path for platform pages. */
  identityKey: string;
}

export function registrableDomain(host: string): string {
  const labels = host.toLowerCase().replace(/\.$/, '').split('.');
  if (labels.length <= 2) return labels.join('.');
  const lastTwo = labels.slice(-2).join('.');
  return SECOND_LEVEL_SUFFIXES.has(lastTwo) ? labels.slice(-3).join('.') : lastTwo;
}

export function normalizeWebsite(raw: string | null | undefined): NormalizedWebsite | null {
  const candidate = raw?.split(/[;\s]+/).find((part) => part.trim() !== '');
  if (candidate === undefined) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(candidate) ? candidate : `http://${candidate}`;

  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  const host = parsed.hostname.toLowerCase().replace(/^(www|m|mobile)\./, '');
  if (!host.includes('.')) return null;

  const domain = registrableDomain(host);
  const platform = PLATFORM_DOMAINS.has(domain);
  const path = decodedPath(parsed.pathname).toLowerCase().replace(/\/+$/, '');
  return {
    url: parsed.toString(),
    host,
    domain,
    platform,
    // A platform page is identified by its host and path (`x.business.site`,
    // `facebook.com/pensiunea-x`); an own website by its registrable domain.
    identityKey: platform ? `${host}${path}` : domain,
  };
}

function decodedPath(pathname: string): string {
  try {
    return decodeURIComponent(pathname);
  } catch {
    return pathname;
  }
}

/** Returns the business email domain, or null for free-mail or malformed addresses. */
export function businessEmailDomain(raw: string | null | undefined): string | null {
  const address = raw?.split(/[;,\s]+/).find((part) => part.includes('@'));
  if (address === undefined) return null;
  const host = address
    .slice(address.lastIndexOf('@') + 1)
    .trim()
    .toLowerCase();
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(host)) return null;
  const domain = registrableDomain(host);
  return FREE_MAIL_PROVIDERS.has(domain.split('.')[0] ?? '') ? null : domain;
}
