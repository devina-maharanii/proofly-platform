import { expect, test } from "@playwright/test";

test.describe("Phase 20 public proof profile", () => {
  test("streams a non-disclosing unavailable profile response with noindex directives", async ({
    page,
  }) => {
    const response = await page.request.get("/talent/not-a-real-profile");
    const html = await response.text();

    expect(response.ok()).toBe(true);
    expect(html).toContain("Profile unavailable | Proofly");
    expect(html).toContain("This profile is unavailable.");
    expect(html).toContain(
      "It may be hidden, still private, no longer shared, or the address may be incorrect."
    );
    expect(html).toContain('name="robots" content="noindex, nofollow"');
    expect(html).not.toMatch(/talent score|leaderboard|followers/i);
  });
});
