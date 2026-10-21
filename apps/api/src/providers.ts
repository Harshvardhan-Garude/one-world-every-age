import type { Assessment, CapabilitySnapshot } from '@beacon/contracts';

// Application interfaces only; actual SDKs, permission mapping and live calls are later tasks.
export interface ProviderContext { ownerId: string; assessment: Assessment; capabilities: CapabilitySnapshot; signal: AbortSignal; contextVersion: number }
export interface PermissionAdapter { resolve(sessionReference: string, signal: AbortSignal): Promise<CapabilitySnapshot> }
export interface ReasoningAdapter { explain(redactedText: string, context: ProviderContext): Promise<unknown> }
export interface RedactionAdapter { redact(audio: Uint8Array, mimeType: string, context: ProviderContext): Promise<{ redactedText: string }> }
export interface SpeechAdapter { speak(validatedText: string, context: ProviderContext): Promise<{ audio: Uint8Array; mimeType: string }> }

export const adapters: { permissions: PermissionAdapter | null; reasoning: ReasoningAdapter | null; redaction: RedactionAdapter | null; speech: SpeechAdapter | null } = {
  permissions: null, reasoning: null, redaction: null, speech: null,
};
