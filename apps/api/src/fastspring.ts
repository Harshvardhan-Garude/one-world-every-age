import { z } from 'zod';
import { BackendError } from './errors.js';
import { providerJson, assertProviderMode } from './provider-http.js';
import type { ProviderContext, ProviderRuntime } from './providers.js';
export interface CheckoutProvider extends ProviderRuntime { checkout(requestId: string, context: ProviderContext): Promise<{ checkoutUrl: string }> }
const pathPattern = /^[a-z0-9-]+\/(web|popup|embedded)-[a-z0-9-]+$/;
export class FastSpringAdapter implements CheckoutProvider {
  readonly transport: 'vendor-test' | 'test-fake';
  constructor(private readonly config: { username: string; password: string; checkoutPath: string; productPath: string; fetcher?: typeof fetch }) {
    if (!config.username || !config.password || !pathPattern.test(config.checkoutPath) || !/^[a-z0-9-]+$/.test(config.productPath)) throw new Error('FastSpring sandbox checkout configuration is incomplete.');
    this.transport = config.fetcher ? 'test-fake' : 'vendor-test';
  }
  status() { return { provider: 'FastSpring' as const, status: this.transport === 'test-fake' ? 'mock' as const : 'implemented but unverified' as const, mode: 'provider-test' as const, detail: 'Eligible adult hosted test checkout only. No saved-method charge, parent linking or purchase approval is implemented.' }; }
  async checkout(requestId: string, context: ProviderContext) {
    assertProviderMode(context, this.transport); await context.assertCurrent();
    const raw = await providerJson({ provider: 'FastSpring', url: `https://api.fastspring.com/v2/checkouts/${this.config.checkoutPath}/sessions`, headers: { Authorization: `Basic ${Buffer.from(`${this.config.username}:${this.config.password}`).toString('base64')}`, 'User-Agent': 'OzoneLayer-Demo/0.1' }, body: {
      live: false, country: 'US', currency: 'USD', orderTags: { ozoneRequest: requestId },
      cart: { lineItems: [{ productPath: this.config.productPath, quantity: 1 }] },
    }, signal: context.signal, fetcher: this.config.fetcher, maxBytes: 65536 });
    try {
      const result = z.object({ id: z.string().min(1).max(100), live: z.literal(false), currency: z.literal('USD'), checkoutStatus: z.array(z.string()), checkoutUrls: z.object({ webcheckoutUrl: z.url() }), cart: z.object({ netTotal: z.literal(1), lineItems: z.array(z.object({ productPath: z.string(), quantity: z.literal(1) })).length(1) }) }).parse(raw);
      const url = new URL(result.checkoutUrls.webcheckoutUrl), store = this.config.checkoutPath.split('/')[0];
      if (!result.checkoutStatus.includes('READY_FOR_CHECKOUT') || result.cart.lineItems[0].productPath !== this.config.productPath || url.protocol !== 'https:' || ![`${store}.test.onfastspring.com`, `${store}.onfastspring.com`].includes(url.hostname) || url.username || url.password || url.port || !url.pathname.includes(result.id)) throw new Error('Unexpected checkout');
      await context.assertCurrent(); return { checkoutUrl: url.href };
    } catch { throw new BackendError(503, 'UNAVAILABLE', 'FastSpring returned no verified test checkout for the server catalog. No charge was attempted.'); }
  }
}
export class UnavailableCheckoutAdapter implements CheckoutProvider {
  readonly transport = 'unavailable' as const;
  status() { return { provider: 'FastSpring' as const, status: 'not configured' as const, mode: null, detail: 'FastSpring sandbox needs API credentials, confirmed FASTSPRING_CHECKOUT_PATH and FASTSPRING_PRODUCT_PATH for the USD 1.00 Ozone theme. Existing FASTSPRING_STOREFRONT is preserved. Parent saved-method flow remains blocked.' }; }
  async checkout(): Promise<never> { throw new BackendError(503, 'UNAVAILABLE', this.status().detail); }
}
export function checkoutAdapterFromEnvironment(env: NodeJS.ProcessEnv): CheckoutProvider {
  return env.FASTSPRING_API_USERNAME?.trim() && env.FASTSPRING_API_PASSWORD?.trim() && pathPattern.test(env.FASTSPRING_CHECKOUT_PATH ?? '') && /^[a-z0-9-]+$/.test(env.FASTSPRING_PRODUCT_PATH ?? '') && env.FASTSPRING_SANDBOX_CONFIRMED === 'true'
    ? new FastSpringAdapter({ username: env.FASTSPRING_API_USERNAME, password: env.FASTSPRING_API_PASSWORD, checkoutPath: env.FASTSPRING_CHECKOUT_PATH!, productPath: env.FASTSPRING_PRODUCT_PATH! }) : new UnavailableCheckoutAdapter();
}
