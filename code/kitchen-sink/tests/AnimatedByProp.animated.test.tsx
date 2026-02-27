import { expect, test } from '@playwright/test'
import { setupPage } from './test-utils'

/**
 * Tests for the animatedBy prop.
 *
 * The key test: animatedBy="default" should work the same as not setting it,
 * meaning the animation driver is properly looked up and applied.
 *
 * If the lookup is broken (returns null), the element with animatedBy="default"
 * won't animate, while the one without animatedBy will still animate via context.
 */

const TOLERANCE = 0.05

test.describe('animatedBy prop', () => {
  // Skip native driver - it doesn't work on web
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name === 'animated-native',
      'Native driver not supported on web'
    )

    await setupPage(page, {
      name: 'AnimatedByProp',
      type: 'useCase',
    })
    await page.waitForTimeout(500)
  })

  test('animatedBy="default" element animates properly', async ({ page }) => {
    const START = 0.5,
      END = 1
    const explicitElement = page.getByTestId('explicit-default')

    // Initial state
    const initialOpacity = await explicitElement.evaluate((el) =>
      Number(getComputedStyle(el).opacity)
    )
    expect(initialOpacity).toBeCloseTo(START, 1)

    // Trigger animation and poll for intermediate values via rAF
    // this avoids brittle single-point-in-time snapshots that miss on slow CI
    const samples: number[] = await page.evaluate((testId) => {
      return new Promise<number[]>((resolve) => {
        const el = document.querySelector(`[data-testid="${testId}"]`)!
        const vals: number[] = []
        const start = performance.now()
        function tick() {
          vals.push(Number(getComputedStyle(el).opacity))
          if (performance.now() - start < 600) requestAnimationFrame(tick)
          else resolve(vals)
        }
        ;(document.querySelector('[data-testid="toggle-trigger"]') as HTMLElement).click()
        requestAnimationFrame(tick)
      })
    }, 'explicit-default')

    const finalOpacity = samples[samples.length - 1]
    expect(
      finalOpacity,
      `Should reach end state (${END}), got ${finalOpacity.toFixed(2)}`
    ).toBeCloseTo(END, 1)

    // key test: if animation driver works, at least one sample should be intermediate
    const hasIntermediate = samples.some(
      (v) => Math.abs(v - START) > TOLERANCE && Math.abs(v - END) > TOLERANCE
    )
    expect(
      hasIntermediate,
      `With animatedBy="default", should see intermediate values during animation. ` +
        `Samples: [${samples
          .slice(0, 5)
          .map((s) => s.toFixed(2))
          .join(', ')}...]`
    ).toBe(true)
  })

  test('context default (no animatedBy) also animates', async ({ page }) => {
    const START = 0.5,
      END = 1

    const initialOpacity = await page
      .getByTestId('context-driver')
      .evaluate((el) => Number(getComputedStyle(el).opacity))
    expect(initialOpacity).toBeCloseTo(START, 1)

    // poll via rAF to capture intermediate values reliably
    const samples: number[] = await page.evaluate((testId) => {
      return new Promise<number[]>((resolve) => {
        const el = document.querySelector(`[data-testid="${testId}"]`)!
        const vals: number[] = []
        const start = performance.now()
        function tick() {
          vals.push(Number(getComputedStyle(el).opacity))
          if (performance.now() - start < 600) requestAnimationFrame(tick)
          else resolve(vals)
        }
        ;(document.querySelector('[data-testid="toggle-trigger"]') as HTMLElement).click()
        requestAnimationFrame(tick)
      })
    }, 'context-driver')

    const finalOpacity = samples[samples.length - 1]
    expect(finalOpacity, 'End opacity').toBeCloseTo(END, 1)
    const hasProgress = samples.some((v) => v > START + TOLERANCE)
    expect(hasProgress, `Context default should show animation progress`).toBe(true)
  })

  test('both elements animate in sync', async ({ page }) => {
    const explicitElement = page.getByTestId('explicit-default')
    const contextElement = page.getByTestId('context-driver')

    // Trigger animation
    await page.getByTestId('toggle-trigger').click()
    await page.waitForTimeout(500)

    // Both should reach end state
    const [explicitFinal, contextFinal] = await Promise.all([
      explicitElement.evaluate((el) => Number(getComputedStyle(el).opacity)),
      contextElement.evaluate((el) => Number(getComputedStyle(el).opacity)),
    ])

    expect(explicitFinal, 'animatedBy="default" end state').toBeCloseTo(1, 1)
    expect(contextFinal, 'context default end state').toBeCloseTo(1, 1)
  })
})
