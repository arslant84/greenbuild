import { scaffoldChallenge } from "./scaffold.js";

// Creates a challenge folder to fill in: pnpm challenges:new <id>
const [root = "challenges", id] = process.argv.slice(2);
if (!id) {
  console.error("usage: pnpm challenges:new <id>");
  process.exit(2);
}
try {
  console.log(`created ${await scaffoldChallenge(root, id)}; follow docs/runbooks/challenge-authoring.md`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
