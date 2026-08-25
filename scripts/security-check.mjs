/** Proofly Phase 15: owned source-only secret guard. It reports rules and paths, never suspected values. */
import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const trackedFiles = execFileSync("git", ["ls-files", "-z"], {
  cwd: root,
  encoding: "utf8",
})
  .split("\0")
  .filter(Boolean);

const forbiddenFileNames = new Set([
  ".env",
  ".env.local",
  ".env.production",
  "id_rsa",
]);
const rules = [
  ["private-key", /-----BEGIN(?: [A-Z]+)? PRIVATE KEY-----/],
  ["supabase-secret-key", /sb_secret_[A-Za-z0-9_-]{12,}/],
  ["stripe-live-key", /sk_live_[A-Za-z0-9]{16,}/],
  ["github-token", /gh[pousr]_[A-Za-z0-9_]{20,}/],
  ["aws-access-key", /AKIA[0-9A-Z]{16}/],
  ["assigned-service-role", /SUPABASE_SERVICE_ROLE_KEY\s*=\s*[^\s"']{8,}/],
];

const findings = [];
for (const relativePath of trackedFiles) {
  const baseName = relativePath.split("/").at(-1);
  if (forbiddenFileNames.has(baseName)) {
    findings.push({ relativePath, rule: "forbidden-secret-file" });
    continue;
  }
  const absolutePath = resolve(root, relativePath);
  if (statSync(absolutePath).size > 1_000_000) continue;
  const content = readFileSync(absolutePath, "utf8");
  if (content.includes("\0")) continue;
  for (const [rule, expression] of rules) {
    if (expression.test(content)) findings.push({ relativePath, rule });
  }
}

if (findings.length > 0) {
  for (const finding of findings) {
    console.error(
      `Security check failed: ${finding.rule} in ${finding.relativePath}`
    );
  }
  process.exitCode = 1;
} else {
  console.log("Security check passed: no tracked secret patterns detected.");
}
