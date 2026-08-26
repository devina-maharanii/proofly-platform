import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("Phase 11 role-neutral authentication foundation", () => {
  test("renders a noindex sign-in route with accessible keyboard-first controls", async ({
    page,
  }) => {
    await page.goto("/sign-in");

    await expect(page).toHaveTitle("Sign in — Proofly");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      /noindex/i
    );
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      /return to the context you control/i
    );
    await expect(page.getByLabel("Email address")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Forgot your password?" })
    ).toBeVisible();

    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("link", { name: "Skip to main content" })
    ).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("main#main-content")).toBeFocused();

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test("shows useful inline registration validation without exposing passwords or provider details", async ({
    page,
  }) => {
    await page.goto("/sign-up");
    await page.getByLabel("Email address").fill("invalid-email");
    await page.getByLabel("Password", { exact: true }).fill("short");
    await page.getByLabel("Confirm password").fill("different");
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page.getByRole("alert")).toContainText(
      "Check the highlighted fields"
    );
    await expect(page.locator("#auth-email-error")).toContainText(
      "valid email"
    );
    await expect(page.getByLabel("Email address")).toHaveValue("invalid-email");
    await expect(page.locator("body")).not.toContainText("short");
  });

  test("keeps recovery messaging non-enumerating and does not disclose an account result in page copy", async ({
    page,
  }) => {
    await page.goto("/forgot-password");

    await expect(
      page.getByRole("heading", { name: /recover access/i })
    ).toBeVisible();
    await expect(page.locator("main")).toContainText(
      "the response is the same whether or not the email has an account"
    );
    await expect(page.getByLabel("Email address")).toBeVisible();
  });

  test("uses a role context only as explanatory copy and does not create role-specific product access", async ({
    page,
  }) => {
    await page.goto("/get-started?role=talent");

    await expect(
      page.getByRole("heading", { name: /choose the context/i })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Build proof account" })
    ).toHaveCount(1);
    await expect(page.locator("main")).toContainText("does not create a role");
    await expect(
      page.getByRole("link", { name: "Build proof account" })
    ).toHaveAttribute("href", "/sign-up?intent=talent");
  });

  test("rejects unauthenticated access to protected session, onboarding, profile, evidence, application, company-receipt, workspace, and reset-password boundaries", async ({
    page,
  }) => {
    await page.goto("/auth/continue");
    await expect(page).toHaveURL(/\/sign-in\?next=%2Fauth%2Fcontinue/);
    await expect(page.getByText(/session has expired/i)).toBeVisible();

    await page.goto("/onboarding?role=reviewer");
    await expect(page).toHaveURL(/\/sign-in\?next=%2Fonboarding/);
    await expect(page.getByText(/session has expired/i)).toBeVisible();

    await page.goto("/profile");
    await expect(page).toHaveURL(/\/sign-in\?next=%2Fprofile/);
    await expect(page.getByText(/session has expired/i)).toBeVisible();

    await page.goto("/profile/evidence");
    await expect(page).toHaveURL(/\/sign-in\?next=%2Fprofile%2Fevidence/);

    await page.goto("/profile/evidence/new");
    await expect(page).toHaveURL(/\/sign-in\?next=%2Fprofile%2Fevidence%2Fnew/);

    await page.goto("/applications");
    await expect(page).toHaveURL(/\/sign-in\?next=%2Fapplications/);

    await page.goto("/applications/123e4567-e89b-42d3-a456-426614174000");
    await expect(page).toHaveURL(
      /\/sign-in\?next=%2Fapplications%2F123e4567-e89b-42d3-a456-426614174000/
    );

    await page.goto(
      "/company/applications/123e4567-e89b-42d3-a456-426614174000"
    );
    await expect(page).toHaveURL(
      /\/sign-in\?next=%2Fcompany%2Fapplications%2F123e4567-e89b-42d3-a456-426614174000/
    );

    await page.goto("/workspaces/123e4567-e89b-42d3-a456-426614174000");
    await expect(page).toHaveURL(
      /\/sign-in\?next=%2Fworkspaces%2F123e4567-e89b-42d3-a456-426614174000/
    );

    await page.goto(
      "/workspaces/123e4567-e89b-42d3-a456-426614174000/tasks/123e4567-e89b-42d3-a456-426614174001"
    );
    await expect(page).toHaveURL(
      /\/sign-in\?next=%2Fworkspaces%2F123e4567-e89b-42d3-a456-426614174000%2Ftasks%2F123e4567-e89b-42d3-a456-426614174001/
    );

    await page.goto(
      "/workspaces/123e4567-e89b-42d3-a456-426614174000/files/123e4567-e89b-42d3-a456-426614174002"
    );
    await expect(page).toHaveURL(
      /\/sign-in\?next=%2Fworkspaces%2F123e4567-e89b-42d3-a456-426614174000%2Ffiles%2F123e4567-e89b-42d3-a456-426614174002/
    );

    await page.goto("/projects/prj_0123456789abcdef01234567/apply");
    await expect(page).toHaveURL(
      /\/sign-in\?next=%2Fprojects%2Fprj_0123456789abcdef01234567%2Fapply/
    );

    await page.goto("/reset-password");
    await expect(page).toHaveURL(/\/sign-in\?next=%2Freset-password/);

    await page.goto("/settings");
    await expect(page).toHaveURL(/\/sign-in\?next=%2Fsettings/);
  });

  test("retains auth reading order without horizontal overflow on a narrow screen", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "mobile",
      "Mobile-only responsive assertion."
    );
    await page.goto("/sign-up");

    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
    await expect(
      page.getByRole("button", { name: "Create account" })
    ).toBeVisible();
  });

  test("keeps the auth surface readable with reduced motion", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/sign-in");

    await expect(
      page.getByRole("heading", { name: /return to the context/i })
    ).toBeVisible();
    const transitionDuration = await page
      .locator(".auth-card")
      .evaluate(element => getComputedStyle(element).transitionDuration);
    expect(Number.parseFloat(transitionDuration)).toBeLessThanOrEqual(0.00001);
  });
});
