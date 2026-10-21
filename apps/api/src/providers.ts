import type { Assessment, CapabilitySnapshot, providerStatusSchema } from '@beacon/contracts';
import type { z } from 'zod';

// Contexts are constructed only by W02 withAuthorizedOperation, never request JSON.
export interface ProviderContext { readonly ownerId: string; readonly assessment: Assessment; readonly capabilities: CapabilitySnapshot; readonly signal: AbortSignal; readonly contextVersion: number; readonly executionMode: 'provider-test' | 'test-fake'; assertCurrent(): Promise<void> }
export type { PermissionAdapter } from './kid.js';
import type { PermissionAdapter } from './kid.js';
export interface ReasoningAdapter { explain(redactedText: string, context: ProviderContext): Promise<unknown> }
export interface RedactionAdapter { redact(audio: Uint8Array, mimeType: string, context: ProviderContext): Promise<{ redactedText: string }> }
export interface SpeechAdapter { speak(validatedText: string, context: ProviderContext): Promise<{ audio: Uint8Array; mimeType: string }> }
export interface ProviderRuntime {
  readonly transport: 'vendor-test' | 'test-fake' | 'unavailable';
  status(): z.infer<typeof providerStatusSchema>;
}
export type ReasoningProvider = ReasoningAdapter & ProviderRuntime;
export type SpeechProvider = SpeechAdapter & ProviderRuntime;

export const adapters: { permissions: PermissionAdapter | null; reasoning: ReasoningAdapter | null; redaction: RedactionAdapter | null; speech: SpeechAdapter | null } = {
  permissions: null, reasoning: null, redaction: null, speech: null,
};
