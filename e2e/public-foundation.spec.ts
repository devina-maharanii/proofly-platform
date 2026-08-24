import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("public marketing foundation", () => {
  test("has truthful route metadata, semantic landmarks, and no WCAG AA axe violations", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(page).toHaveTitle(
      "Proofly — Trusted opportunities through real work"
    );
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      /real software work visible, reviewable, and understandable/i
    );
    await expect(page.locator("main#main-content")).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(
      page.getByRole("navigation", { name: "Primary navigation" })
    ).toHaveCount(1);
    await expect(page.getByRole("contentinfo")).toHaveCount(1);

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test("keeps the persisted dark color system free of WCAG AA axe violations", async ({
    page,
  }) => {
    await page.goto("/");

    const html = page.locator("html");
    const startsDark = await html.evaluate(element =>
      element.classList.contains("dark")
    );

    if (!startsDark) {
      await page.getByRole("button", { name: /switch to dark theme/i }).click();
    }

    await expect(html).toHaveClass(/dark/);

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test("keeps skip navigation, focus order, and named controls keyboard usable", async ({
    page,
  }, testInfo) => {
    await page.goto("/");

    await page.keyboard.press("Tab");
    const skipLink = page.getByRole("link", { name: "Skip to main content" });
    await expect(skipLink).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("#main-content")).toBeFocused();

    await expect(
      page.getByRole("button", { name: /switch to (dark|light) theme/i })
    ).toHaveCount(1);
    if (testInfo.project.name === "desktop") {
      await expect(
        page.getByRole("button", { name: "Sign in" })
      ).toBeDisabled();
    } else {
      await expect(page.locator(".mobile-menu summary")).toBeVisible();
    }
    await expect(page.getByRole("link", { name: "Choose a role" })).toHaveCount(
      1
    );
  });

  test("keeps mobile navigation and evidence preview usable without horizontal overflow", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "mobile",
      "Mobile-only responsive assertion."
    );
    await page.goto("/");

    await page.locator(".mobile-menu summary").click();
    await expect(
      page.getByRole("link", { name: "For talent" }).last()
    ).toBeVisible();
    await expect(page.locator(".product-preview")).toBeVisible();

    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
  });

  test("provides a static reduced-motion fallback", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");

    const scrollBehavior = await page.evaluate(
      () => getComputedStyle(document.documentElement).scrollBehavior
    );
    expect(scrollBehavior).toBe("auto");
    await expect(
      page.getByRole("heading", { name: /build work people can trust/i })
    ).toBeVisible();
  });
});
