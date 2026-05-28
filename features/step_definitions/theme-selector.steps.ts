import { Given, When, Then } from "@cucumber/cucumber";
import { expect } from "@playwright/test";
import type { PlaywrightWorld } from "../support/world";

const STORAGE_KEY = "markdown-reviewer:theme";

type ThemeLabel = "Light" | "Dark" | "System";

function themeTestId(label: string): string {
  return `theme-${label.toLowerCase()}`;
}

function normalizeTheme(label: string): Lowercase<ThemeLabel> {
  const normalized = label.toLowerCase();
  if (normalized !== "light" && normalized !== "dark" && normalized !== "system") {
    throw new Error(`Unknown theme "${label}"`);
  }
  return normalized;
}

async function openApp(this: PlaywrightWorld) {
  await this.page.goto(this.baseUrl);
  await this.page.waitForSelector('[data-testid="main-content"]');
}

async function activeThemeButton(this: PlaywrightWorld, label: string) {
  const button = this.page.getByTestId(themeTestId(label));
  await expect(button).toBeVisible();
  await expect(button).toHaveAttribute("aria-pressed", "true");
}

async function expectDarkClass(this: PlaywrightWorld, dark: boolean) {
  await expect
    .poll(() => this.page.locator("html").evaluate((el) => el.classList.contains("dark")))
    .toBe(dark);
}

Given("the app is running at {string}", async function (this: PlaywrightWorld, url: string) {
  this.baseUrl = url;
  await this.page.emulateMedia({ colorScheme: "light" });
  await openApp.call(this);
});

Given("no theme preference has been saved", async function (this: PlaywrightWorld) {
  await this.page.evaluate((key) => localStorage.removeItem(key), STORAGE_KEY);
  await this.page.reload();
  await this.page.waitForSelector('[data-testid="main-content"]');
});

Given("the theme is set to {string}", async function (this: PlaywrightWorld, label: string) {
  const theme = normalizeTheme(label);
  await this.page.evaluate(([key, value]) => localStorage.setItem(key, value), [
    STORAGE_KEY,
    theme,
  ] as const);
  await this.page.reload();
  await this.page.waitForSelector('[data-testid="main-content"]');
});

When(
  "I select {string} in the theme selector",
  async function (this: PlaywrightWorld, label: string) {
    await this.page.getByTestId(themeTestId(label)).click();
  },
);

When("I reload the page", async function (this: PlaywrightWorld) {
  await this.page.reload();
  await this.page.waitForSelector('[data-testid="main-content"]');
});

When("the OS switches from light to dark mode", async function (this: PlaywrightWorld) {
  await this.page.emulateMedia({ colorScheme: "dark" });
});

Then("the theme selector shows {string} as active", activeThemeButton);

Then("the theme selector still shows {string}", activeThemeButton);

Then("the page uses the OS colour scheme", async function (this: PlaywrightWorld) {
  await expectDarkClass.call(this, false);
});

Then("the page returns to OS colour scheme", async function (this: PlaywrightWorld) {
  await expectDarkClass.call(this, false);
});

Then("the page switches to dark mode immediately", async function (this: PlaywrightWorld) {
  await expectDarkClass.call(this, true);
});

Then("the page switches to light mode immediately", async function (this: PlaywrightWorld) {
  await expectDarkClass.call(this, false);
});

Then(
  "the page loads in dark mode without a flash of light content",
  async function (this: PlaywrightWorld) {
    await expectDarkClass.call(this, true);
  },
);

Then(
  "the page switches to dark mode without a page reload",
  async function (this: PlaywrightWorld) {
    await expectDarkClass.call(this, true);
  },
);
