import type { Assessment, CapabilitySnapshot } from '@beacon/contracts';

// W02 permission lifecycle is implemented separately. AI/audio SDKs and live calls remain later tasks.
export interface ProviderContext { readonly ownerId: string; readonly assessment: Assessment; readonly capabilities: CapabilitySnapshot; readonly signal: AbortSignal; readonly contextVersion: number; readonly executionMode: 'provider-test' | 'test-fake'; assertCurrent(): Promise<void> }
export type { PermissionAdapter } from './kid.js';
import type { PermissionAdapter } from './kid.js';
export interface ReasoningAdapter { explain(redactedText: string, context: ProviderContext): Promise<unknown> }
export interface RedactionAdapter { redact(audio: Uint8Array, mimeType: string, context: ProviderContext): Promise<{ redactedText: string }> }
export interface SpeechAdapter { speak(validatedText: string, context: ProviderContext): Promise<{ audio: Uint8Array; mimeType: string }> }

export const adapters: { permissions: PermissionAdapter | null; reasoning: ReasoningAdapter | null; redaction: RedactionAdapter | null; speech: SpeechAdapter | null } = {
  permissions: null, reasoning: null, redaction: null, speech: null,
};
