import { validateChallenge } from "./validate.js";

// Prints a valid challenge's manifest as JSON, defaults filled in, for scripts such as
// challenges/verify-challenge.sh: node dist/inspect.js <challenge-dir>
const dir = process.argv[2];
if (!dir) {
  console.error("usage: inspect.js <challenge-dir>");
  process.exit(2);
}
const report = await validateChallenge(dir);
if (report.errors.length > 0 || !report.manifest) {
  for (const error of report.errors) {
    console.error(`${report.id}: ${error}`);
  }
  process.exit(1);
}
console.log(JSON.stringify(report.manifest));
