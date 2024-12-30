import { expect, test } from '@playwright/test'

test('sendrecv x2', async ({ browser }) => {
  const sendrecv1 = await browser.newPage()
  const sendrecv2 = await browser.newPage()

  await sendrecv1.goto('http://localhost:9000/sendrecv/')
  await sendrecv2.goto('http://localhost:9000/sendrecv/')

  await sendrecv1.click('#connect')
  await sendrecv2.click('#connect')

  // レース対策
  await sendrecv1.waitForTimeout(3000)
  await sendrecv2.waitForTimeout(3000)

  await sendrecv1.click('#disconnect')
  await sendrecv2.click('#disconnect')

  await sendrecv1.close()
  await sendrecv2.close()
})