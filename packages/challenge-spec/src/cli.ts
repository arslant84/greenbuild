import { validateAll } from "./validate.js";

// Validates every challenge folder: pnpm challenges:validate [challenges-dir]
const root = process.argv[2] ?? "challenges";
const reports = await validateAll(root);
if (reports.length === 0) {
  console.error(`no challenges found in ${root}`);
  process.exit(1);
}
for (const report of reports) {
  if (report.errors.length === 0) {
    console.log(`ok: ${report.id}`);
    continue;
  }
  console.error(`FAIL: ${report.id}`);
  for (const error of report.errors) {
    console.error(`  - ${error}`);
  }
}
process.exitCode = reports.some((report) => report.errors.length > 0) ? 1 : 0;
