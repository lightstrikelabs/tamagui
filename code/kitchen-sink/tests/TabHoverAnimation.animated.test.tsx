import { expect, test } from '@playwright/test'
import { setupPage } from './test-utils'

test.use({
  viewport: { width: 600, height: 400 },
  launchOptions: {
    args: ['--window-position=1400,700', '--window-size=620,420'],
  },
})

test.beforeEach(async ({ page }) => {
  await setupPage(page, { name: 'TabHoverAnimationCase', type: 'useCase' })
  await page.waitForTimeout(500)
})

const TAB_IDS = ['tab-tab-a', 'tab-tab-b', 'tab-tab-c', 'tab-tab-d', 'tab-tab-e']

// hover a tab by moving the mouse to its center
async function hoverTab(page: any, tabId: string) {
  const tab = page.locator(`[data-testid="${tabId}"]`)
  await tab.hover()
  await page.waitForTimeout(50)
}

// rapidly sweep across tabs left-to-right or right-to-left
async function sweepTabs(page: any, ids: string[], delayMs = 30) {
  for (const id of ids) {
    await page.locator(`[data-testid="${id}"]`).hover()
    await page.waitForTimeout(delayMs)
  }
}

async function getGoingDirection(page: any): Promise<number> {
  return page.locator('#going-direction').evaluate((el: HTMLElement) => {
    return Number(el.dataset.going || '0')
  })
}

async function getSlideContentInfo(page: any) {
  return page.evaluate(() => {
    const els = document.querySelectorAll('[data-testid="slide-content"]')
    return Array.from(els).map((el) => ({
      tab: (el as HTMLElement).dataset.tab,
      going: (el as HTMLElement).dataset.going,
      transform: getComputedStyle(el).transform,
      opacity: getComputedStyle(el).opacity,
    }))
  })
}

// track translateX over several rAF frames
async function trackTranslateX(page: any, selector: string, frames = 6) {
  return page.evaluate(
    ({ selector, frames }) => {
      return new Promise<number[]>((resolve) => {
        const el = document.querySelector(selector)
        if (!el) return resolve([])
        const values: number[] = []
        let count = 0
        function tick() {
          const style = getComputedStyle(el!)
          const matrix = new DOMMatrix(style.transform)
          values.push(matrix.m41)
          count++
          if (count < frames) {
            requestAnimationFrame(tick)
          } else {
            resolve(values)
          }
        }
        requestAnimationFrame(tick)
      })
    },
    { selector, frames }
  )
}

// === Bug 1: AnimatePresence direction ===

test('direction: hover right sets going=1', async ({ page }) => {
  await hoverTab(page, 'tab-tab-a')
  await page.waitForTimeout(200)
  await hoverTab(page, 'tab-tab-c')
  await page.waitForTimeout(200)
  const going = await getGoingDirection(page)
  expect(going).toBe(1)
})

test('direction: hover left sets going=-1', async ({ page }) => {
  await hoverTab(page, 'tab-tab-d')
  await page.waitForTimeout(200)
  await hoverTab(page, 'tab-tab-b')
  await page.waitForTimeout(200)
  const going = await getGoingDirection(page)
  expect(going).toBe(-1)
})

test('direction: rapid sweep right then left preserves correct direction', async ({
  page,
}) => {
  // sweep all the way right
  await sweepTabs(page, TAB_IDS, 30)
  await page.waitForTimeout(100)
  const goingAfterRight = await getGoingDirection(page)
  expect(goingAfterRight).toBe(1)

  // sweep all the way left
  await sweepTabs(page, [...TAB_IDS].reverse(), 30)
  await page.waitForTimeout(100)
  const goingAfterLeft = await getGoingDirection(page)
  expect(goingAfterLeft).toBe(-1)
})

test('direction: exiting content slides opposite to entering content', async ({
  page,
}) => {
  // hover tab A and wait for it to be visible
  await hoverTab(page, 'tab-tab-a')
  await page.waitForTimeout(300)

  // now hover tab D (to the right) - tab A should exit LEFT, tab D enters from RIGHT
  await hoverTab(page, 'tab-tab-d')

  // wait a frame then check all slide-content elements
  await page.waitForTimeout(50)
  const infos = await getSlideContentInfo(page)

  // there should be 2 elements (entering + exiting) or 1 if exit already completed
  // the entering one should have data-tab="Tab D"
  const entering = infos.find((i: any) => i.tab === 'Tab D')
  expect(entering).toBeTruthy()

  // going direction should be 1 (rightward)
  const going = await getGoingDirection(page)
  expect(going).toBe(1)
})

test('direction: exiting element keeps original direction when going reverses', async ({
  page,
}) => {
  // hover Tab A → wait for it to appear
  await hoverTab(page, 'tab-tab-a')
  await page.waitForTimeout(300)

  // collect console logs
  const consoleLogs: string[] = []
  page.on('console', (msg: any) => {
    if (msg.text().includes('[exit-debug]')) {
      consoleLogs.push(msg.text())
    }
  })

  // hover Tab E → Tab A starts exiting LEFT (going=1, exitStyle x=-100)
  await hoverTab(page, 'tab-tab-e')
  await page.waitForTimeout(80) // let exit animation start

  // hover Tab B → going changes to -1
  // BUG: this should NOT change Tab A's exit direction
  await hoverTab(page, 'tab-tab-b')
  await page.waitForTimeout(30)

  // print debug logs
  for (const log of consoleLogs) {
    console.log(log)
  }

  // sample Tab A's current translateX - it should be NEGATIVE (exiting left)
  const tabAX = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('[data-testid="slide-content"]'))
    for (let i = 0; i < els.length; i++) {
      const el = els[i] as HTMLElement
      if (el.dataset.tab === 'Tab A') {
        const matrix = new DOMMatrix(getComputedStyle(el).transform)
        return matrix.m41
      }
    }
    return null
  })

  // Tab A should be exiting LEFT (negative x), not RIGHT (positive x)
  // null means it already exited (which is fine)
  if (tabAX !== null) {
    expect(tabAX, `Tab A x=${tabAX}, should be negative (exiting left)`).toBeLessThan(0)
  }
})

// === Bug 2: CSS driver x animation ===

test('x animation fires during tab switch', async ({ page }) => {
  await hoverTab(page, 'tab-tab-a')
  await page.waitForTimeout(300)

  // hover tab D - should trigger x animation
  await hoverTab(page, 'tab-tab-d')

  const values = await trackTranslateX(page, '[data-testid="slide-content"]', 6)

  // at least one frame should show non-zero translateX during enter animation
  const hasMovement = values.some((v) => Math.abs(v) > 1)
  expect(hasMovement).toBe(true)
})

// === Bug 3: Exit completion / ghost content ===

test('exit completes: no ghost content after mouse leaves', async ({ page }) => {
  await hoverTab(page, 'tab-tab-b')
  await page.waitForTimeout(300)

  // move mouse away
  await page.mouse.move(0, 0)
  await page.waitForTimeout(600)

  const slideContent = page.locator('[data-testid="slide-content"]')
  await expect(slideContent).toHaveCount(0, { timeout: 2000 })
})

test('exit completes: rapid sweep then leave has no ghosts', async ({ page }) => {
  // rapidly sweep across all tabs
  await sweepTabs(page, TAB_IDS, 30)
  await page.waitForTimeout(100)

  // move mouse away
  await page.mouse.move(0, 0)
  await page.waitForTimeout(600)

  const slideContent = page.locator('[data-testid="slide-content"]')
  await expect(slideContent).toHaveCount(0, { timeout: 2000 })
})

test('rapid switching: no stuck ghost elements', async ({ page }) => {
  // rapidly sweep right
  await sweepTabs(page, TAB_IDS, 30)
  // settle on last tab
  await page.waitForTimeout(400)

  // should only have ONE slide-content element
  const slideContents = page.locator('[data-testid="slide-content"]')
  const count = await slideContents.count()
  expect(count).toBeLessThanOrEqual(1)
})

test('rapid back-and-forth: no stuck elements', async ({ page }) => {
  // quickly bounce between tabs
  for (let i = 0; i < 3; i++) {
    await sweepTabs(page, TAB_IDS, 20)
    await sweepTabs(page, [...TAB_IDS].reverse(), 20)
  }

  // settle on tab C
  await hoverTab(page, 'tab-tab-c')
  await page.waitForTimeout(500)

  const slideContents = page.locator('[data-testid="slide-content"]')
  const count = await slideContents.count()
  expect(count).toBeLessThanOrEqual(1)

  // and it should show Tab C content
  if (count === 1) {
    const tab = await slideContents.getAttribute('data-tab')
    expect(tab).toBe('Tab C')
  }
})

test('exit animation runs to completion on tab switch', async ({ page }) => {
  await hoverTab(page, 'tab-tab-c')
  await page.waitForTimeout(300)

  await hoverTab(page, 'tab-tab-a')
  await page.waitForTimeout(500)

  const slideContent = page.locator('[data-testid="slide-content"]')
  const tab = await slideContent.getAttribute('data-tab')
  expect(tab).toBe('Tab A')
})

// === Bug 4: Popover position tracks active tab ===

test('popover position moves when hovering different tabs', async ({ page }) => {
  // hover tab A, record popover position
  await hoverTab(page, 'tab-tab-a')
  await page.waitForTimeout(400)

  const content = page.locator('[data-testid="hover-content"]')
  const box1 = await content.boundingBox()

  // hover tab E (far right)
  await hoverTab(page, 'tab-tab-e')
  await page.waitForTimeout(400)

  const box2 = await content.boundingBox()

  // popover should have moved right
  if (box1 && box2) {
    expect(box2.x).toBeGreaterThan(box1.x)
  } else {
    // if popover didn't render, fail
    expect(box1).toBeTruthy()
    expect(box2).toBeTruthy()
  }
})

test('popover position follows rapid sweep', async ({ page }) => {
  // hover tab A first
  await hoverTab(page, 'tab-tab-a')
  await page.waitForTimeout(300)

  const content = page.locator('[data-testid="hover-content"]')
  const boxStart = await content.boundingBox()

  // rapidly sweep to tab E
  await sweepTabs(page, TAB_IDS, 40)
  await page.waitForTimeout(400)

  const boxEnd = await content.boundingBox()

  if (boxStart && boxEnd) {
    // should have moved substantially to the right
    expect(boxEnd.x).toBeGreaterThan(boxStart.x)
  }
})
