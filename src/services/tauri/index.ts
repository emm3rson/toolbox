import { mockTauriAdapter } from './mockAdapter'
export * from './contracts'

// Replace this export with an invoke()-backed adapter when native commands land.
export const desktop = mockTauriAdapter
