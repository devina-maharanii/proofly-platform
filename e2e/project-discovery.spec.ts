import { expect, test } from "@playwright/test";

test("public project discovery exposes deterministic filters, no-result recovery, and no application workflow", async ({
  page,
}) => {
  await page.goto("/projects?q=unmatched-proofly-project&sort=newest");
  await expect(
    page.getByRole("heading", { name: /read the terms before you decide/i })
  ).toBeVisible();
  await expect(page.getByLabel("Search published project context")).toHaveValue(
    "unmatched-proofly-project"
  );
  await expect(
    page.getByText(
      /ranking uses your visible query, filters, relevance, and freshness/i
    )
  ).toBeVisible();
  await expect(
    page.getByText(/no published projects match these terms/i)
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /explore all published projects/i })
  ).toHaveAttribute("href", "/projects");
  await expect(
    page.getByText(/apply now|send message|start payment/i)
  ).toHaveCount(0);
});

test("query-specific project discovery state is non-indexable", async ({
  page,
}) => {
  await page.goto("/projects?skill=typescript");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /noindex/
  );
});
