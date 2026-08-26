import { expect, test } from "@playwright/test";

test.describe("Phase 22 public project route", () => {
  test("returns a non-disclosing unavailable Project/Challenge response with noindex directives", async ({
    page,
  }) => {
    const response = await page.request.get(
      "/projects/prj_1234567890abcdef12345678"
    );
    const html = await response.text();

    expect(response.ok()).toBe(true);
    expect(html).toContain("Project context unavailable | Proofly");
    expect(html).toContain("This project page is not available.");
    expect(html).toContain(
      "It may not exist, may be private, may not be published, or may not be available to this request."
    );
    expect(html).toContain('name="robots" content="noindex, nofollow"');
    expect(html).not.toMatch(
      /apply now|send message|invite now|payment|contract|hiring decision/i
    );
  });
});
