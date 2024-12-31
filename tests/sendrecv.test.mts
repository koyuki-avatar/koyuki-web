import { expect, test } from '@playwright/test'

test('sendrecv x2', async ({ browser }) => {
  const sendrecv1 = await browser.newPage()
  const sendrecv2 = await browser.newPage()

  await sendrecv1.goto('http://localhost:9000/sendrecv/')
  await sendrecv2.goto('http://localhost:9000/sendrecv/')

  await sendrecv1.click('#connect')
  await sendrecv2.click('#connect')

  await expect(sendrecv1.locator('#connection-state')).toHaveAttribute(
    'data-connection-state',
    'connected',
  )
  await expect(sendrecv2.locator('#connection-state')).toHaveAttribute(
    'data-connection-state',
    'connected',
  )

  // レース対策
  await sendrecv1.waitForTimeout(1000)
  await sendrecv2.waitForTimeout(1000)

  await sendrecv1.click('#disconnect')
  await sendrecv2.click('#disconnect')

  await sendrecv1.close()
  await sendrecv2.close()
})