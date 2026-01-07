import * as dotenv from "dotenv";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

// Load .env file from the same directory as this file
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env') });

import { genkit } from "genkit";
import { sapAiCore } from "../shared/sap-aicore-genkit.js";

export const ai = genkit({
  plugins: [sapAiCore()],
  model: sapAiCore.model("gpt-4o"),
  promptDir: __dirname,
});

export { z } from "genkit";
