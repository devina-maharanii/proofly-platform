import { expect, test } from "@playwright/test";

test.describe("Phase 21 public company profile", () => {
  test("streams a non-disclosing unavailable company response with noindex directives", async ({
    page,
  }) => {
    const response = await page.request.get("/companies/not-a-real-company");
    const html = await response.text();

    expect(response.ok()).toBe(true);
    expect(html).toContain("Company context unavailable | Proofly");
    expect(html).toContain("This public company page is not available.");
    expect(html).toContain(
      "It may not exist, may be hidden, or may not be available to this request."
    );
    expect(html).toContain('name="robots" content="noindex, nofollow"');
    expect(html).not.toMatch(
      /apply now|send message|company score|leaderboard/i
    );
  });
});
