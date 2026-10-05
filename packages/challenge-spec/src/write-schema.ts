import { writeFile } from "node:fs/promises";
import { manifestJsonSchemaText } from "./json-schema.js";

// Regenerates challenge.schema.json from the zod schema: pnpm challenges:schema
const target = new URL("../challenge.schema.json", import.meta.url);
await writeFile(target, manifestJsonSchemaText());
console.log(`wrote ${target.pathname}`);
