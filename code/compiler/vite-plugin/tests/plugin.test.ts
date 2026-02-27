import { describe, expect, test } from 'vitest'
import { tamaguiPlugin } from '../src/plugin'

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
