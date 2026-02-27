import { describe, expect, test } from 'vitest'
import { existsSync } from 'node:fs'
import { tamaguiAliases } from '../src/plugin'

describe('tamaguiAliases', () => {
  test('returns empty array with no options', () => {
    expect(tamaguiAliases({})).toEqual([])
  })

  test('returns empty array with default options', () => {
    expect(tamaguiAliases()).toEqual([])
  })

  test('svg option adds react-native-svg alias', () => {
    const aliases = tamaguiAliases({ svg: true })
    expect(aliases).toHaveLength(1)
    expect(aliases[0].find).toBe('react-native-svg')
    expect(typeof aliases[0].replacement).toBe('string')
  })

  test('rnwLite option adds react-native aliases', () => {
    const aliases = tamaguiAliases({ rnwLite: true })
    expect(aliases.length).toBeGreaterThanOrEqual(3)

    const finds = aliases.map((a) => (a.find instanceof RegExp ? a.find.source : a.find))
    expect(finds).toContain('^react-native$')
    expect(finds).toContain('^react-native-web$')
    expect(finds).toContain('react-native/package.json')
  })

  test('rnwLite "without-animated" uses without-animated entry', () => {
    const aliases = tamaguiAliases({ rnwLite: 'without-animated' })
    const rnAlias = aliases.find(
      (a) => a.find instanceof RegExp && a.find.source === '^react-native$'
    )
    expect(rnAlias).toBeDefined()
    expect(rnAlias!.replacement).toContain('without-animated')
  })

  test('all resolved paths exist on disk', () => {
    const aliases = tamaguiAliases({ svg: true, rnwLite: true })
    for (const alias of aliases) {
      // regex replacements with $1 are templates, not real paths
      if (alias.replacement.includes('$1')) continue
      expect(existsSync(alias.replacement), `missing: ${alias.replacement}`).toBe(true)
    }
  })
})
