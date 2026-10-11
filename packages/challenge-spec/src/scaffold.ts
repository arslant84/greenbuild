import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { challengeManifestSchema } from "@greenbuild/shared";
import { exists } from "./exists.js";
import {
  CHECK_TEMPLATE,
  DOCKERFILE_TEMPLATE,
  HINTS_TEMPLATE,
  manifestTemplate,
  readmeTemplate,
  SETUP_TEMPLATE,
  SOLUTION_TEMPLATE,
} from "./scaffold-templates.js";

// scaffoldChallenge creates challengesDir/id with every required file (task 53) and returns its path.
// It refuses an id the manifest would refuse and a folder that already exists.
export async function scaffoldChallenge(challengesDir: string, id: string): Promise<string> {
  if (!challengeManifestSchema.shape.id.safeParse(id).success) {
    throw new Error(`challenges:new: "${id}" is not a valid challenge id (lowercase letters, digits and hyphens)`);
  }
  const dir = join(challengesDir, id);
  if (await exists(dir)) {
    throw new Error(`challenges:new: ${dir} already exists`);
  }
  await mkdir(dir);
  const files: Record<string, string> = {
    "challenge.yaml": manifestTemplate(id),
    Dockerfile: DOCKERFILE_TEMPLATE,
    "setup.sh": SETUP_TEMPLATE,
    "check.sh": CHECK_TEMPLATE,
    "solution.sh": SOLUTION_TEMPLATE,
    "hints.md": HINTS_TEMPLATE,
    "README.md": readmeTemplate(id),
  };
  for (const [name, content] of Object.entries(files)) {
    await writeFile(join(dir, name), content, { mode: name.endsWith(".sh") ? 0o755 : 0o644 });
  }
  return dir;
}
