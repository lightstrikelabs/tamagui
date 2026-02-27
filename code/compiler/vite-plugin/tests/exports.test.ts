import { describe, expect, test } from 'vitest'
import { createRequire } from 'node:module'

describe('module exports', () => {
  test('ESM import exports tamaguiPlugin and tamaguiAliases as functions', async () => {
    const mod = await import('../src/plugin')
    expect(typeof mod.tamaguiPlugin).toBe('function')
    expect(typeof mod.tamaguiAliases).toBe('function')
  })

  test('CJS require exports tamaguiPlugin and tamaguiAliases as functions', () => {
    const require = createRequire(import.meta.url)
    const mod = require('../dist/cjs/index.cjs')
    expect(typeof mod.tamaguiPlugin).toBe('function')
    expect(typeof mod.tamaguiAliases).toBe('function')
  })
})
