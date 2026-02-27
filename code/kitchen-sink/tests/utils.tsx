import type { Locator } from '@playwright/test'

export async function getStyles(locator: Locator) {
  return await locator.evaluate((el) => {
    return window.getComputedStyle(el)
  })
}

type InteractionOpts = {
  delay?: number
}

export async function whilePressed<A>(
  locator: Locator,
  cb: () => Promise<A>,
  _opts?: InteractionOpts
) {
  // use explicit mouse.down/up instead of click({ delay }) for reliable
  // pressed state testing - click timing is imprecise on slow CI
  const box = await locator.boundingBox()
  if (!box) throw new Error('Element not visible')
  const page = locator.page()
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.waitForTimeout(150)
  const res = await cb()
  await page.mouse.up()
  return res
}

export async function whileHovered<A>(locator: Locator, cb: () => Promise<A>) {
  await locator.hover({
    force: true,
  })
  return await cb()
}

export async function getPressStyle(locator: Locator, opts?: InteractionOpts) {
  return await whilePressed(
    locator,
    async () => {
      return await getStyles(locator)
    },
    opts
  )
}

export async function getHoverStyle(locator: Locator) {
  return await whileHovered(locator, async () => {
    return await getStyles(locator)
  })
}
