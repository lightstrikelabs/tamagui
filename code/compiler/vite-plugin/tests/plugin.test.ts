import { describe, expect, test, vi } from 'vitest'

vi.mock('../src/loadTamagui', () => ({
  loadTamaguiBuildConfig: vi.fn(),
  getLoadPromise: vi.fn(() => null),
  getTamaguiOptions: vi.fn(() => null),
  ensureFullConfigLoaded: vi.fn(),
}))

const { tamaguiPlugin } = await import('../src/plugin')

const expectedPluginNames = ['tamagui', 'tamagui-rnw-lite', 'tamagui-extract']

describe('tamaguiPlugin', () => {
  test('returns array of 3 plugins with correct names', () => {
    const plugins = tamaguiPlugin() as any[]
    expect(plugins).toHaveLength(3)
    expect(plugins.map((p) => p.name)).toEqual(expectedPluginNames)
  })

  test('disableExtraction still returns 3 plugins', () => {
    const plugins = tamaguiPlugin({ disableExtraction: true }) as any[]
    expect(plugins).toHaveLength(3)
    expect(plugins.map((p) => p.name)).toEqual(expectedPluginNames)
  })
})
