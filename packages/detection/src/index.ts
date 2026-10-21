import { parse } from 'tldts';
import type { Assessment } from '@beacon/contracts';

export interface LocalScanInput { actualUrl: string; visibleText: string; linkDestinations: readonly string[]; language: string }
export interface LocalScanResult { state: Assessment['state']; findings: readonly Assessment[]; detectorVersion: string }
export type LocalDetector = (input: LocalScanInput) => LocalScanResult;

// URL interpretation only. This neither establishes brand ownership nor detects fraud.
export function describeUrl(input: string) {
  if (input.length > 2048) throw new Error('URL exceeds limit');
  const url = new URL(input);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Only HTTP(S) URLs without credentials are supported');
  const parsed = parse(url.hostname, { allowPrivateDomains: true });
  return { hostname: url.hostname, registrableDomain: parsed.domain, publicSuffix: parsed.publicSuffix, isIp: parsed.isIp === true };
}

export const detectionStatus = 'not implemented' as const;
