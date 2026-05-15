import { Given, When, Then } from '@cucumber/cucumber'
import type { PlaywrightWorld } from '../support/world'

Given('the demo project is seeded', function (this: PlaywrightWorld) {
  throw new Error('Use "the demo project is running at" in viewer.feature instead')
})

When('I open the file {string}', function (this: PlaywrightWorld, _file: string) {
  throw new Error('Use viewer.feature steps instead')
})

Then('I see the rendered heading {string}', function (this: PlaywrightWorld, _heading: string) {
  throw new Error('Use viewer.feature steps instead')
})
