import type { ChannelSourceAdapter } from './base.js'
import { WebFormAdapter } from './adapters/web-form.js'

export type { ChannelSourceAdapter, CapturedEvent } from './base.js'

const registry = new Map<string, ChannelSourceAdapter>([
  ['web-form', new WebFormAdapter()],
])

export function getAdapter(source: string): ChannelSourceAdapter | undefined {
  return registry.get(source)
}

export function listSources(): string[] {
  return Array.from(registry.keys())
}
