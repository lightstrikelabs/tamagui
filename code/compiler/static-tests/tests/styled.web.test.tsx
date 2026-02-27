import dedent from 'dedent'
import * as React from 'react'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'

import { extractForWeb } from './lib/extract'

Error.stackTraceLimit = Number.MAX_SAFE_INTEGER
process.env.TAMAGUI_TARGET = 'web'
window['React'] = React

describe('styled() tests', () => {
  test('loads dynamic styled() in file and extracts CSS', async () => {
    const output = await extractForWeb(
      dedent`
      import { MyStack } from '@tamagui/test-design-system'
      import { styled } from '@tamagui/core'

      // not exported
      const InlineStyled = styled(MyStack, {
        backgroundColor: 'orange'
      })

      export function Test() {
        return <InlineStyled />
      }
    `,
      { options: { enableDynamicEvaluation: true } }
    )
    if (!output) {
      throw new Error(`No output`)
    }

    // styled() extraction should produce CSS rules for backgroundColor
    expect(output.styles).toContain('background-color')
    expect(output.styles).toContain('orange')
    // should also extract the JSX usage
    expect(output.js).toContain('className')
  })

  test('extracts to className at call-site', async () => {
    const output = await extractForWeb(`
      import { MyStack } from '@tamagui/test-design-system'

      export function Test() {
        return <MyStack />
      }
    `)
    if (!output) {
      throw new Error(`No output`)
    }

    expect(output.js).toMatchSnapshot()
    expect(output.styles).toMatchSnapshot()
  })

  describe('cross-file styled() optimization', () => {
    const tmpDir = join(__dirname, '.tmp-cross-file-test')
    const componentFile = join(tmpDir, 'MyBox.tsx')

    beforeAll(() => {
      mkdirSync(tmpDir, { recursive: true })
      writeFileSync(
        componentFile,
        dedent`
          import { styled, View } from '@tamagui/core'

          export const MyBox = styled(View, {
            backgroundColor: 'red',
            padding: 10,
          })
        `
      )
    })

    afterAll(() => {
      if (existsSync(tmpDir)) {
        rmSync(tmpDir, { recursive: true })
      }
    })

    test('extracts CSS for styled component imported from another file', async () => {
      const componentSource = dedent`
        import { styled, View } from '@tamagui/core'

        export const MyBox = styled(View, {
          backgroundColor: 'red',
          padding: 10,
        })
      `

      // first process the component file (like vite plugin would)
      const componentOutput = await extractForWeb(componentSource, {
        sourcePath: componentFile,
        options: { enableDynamicEvaluation: true },
      })
      expect(componentOutput).toBeTruthy()
      expect(componentOutput!.styles).toContain('background-color')

      // now process the consumer file - MyBox should be in the dynamic cache
      const consumerSource = dedent`
        import { MyBox } from './MyBox'

        export function Test() {
          return <MyBox />
        }
      `

      const consumerPath = join(tmpDir, 'Consumer.tsx')
      const output = await extractForWeb(consumerSource, {
        sourcePath: consumerPath,
        options: { enableDynamicEvaluation: true },
      })

      if (!output) {
        throw new Error(`No output - file was skipped entirely`)
      }

      // the consumer file should get className optimization
      expect(output.js).toContain('className')
    })
  })
})
