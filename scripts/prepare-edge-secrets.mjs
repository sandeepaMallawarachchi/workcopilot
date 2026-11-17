import { writeFile } from "node:fs/promises";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
const required = [
  "WHATSAPP_VERIFY_TOKEN",
  "WHATSAPP_APP_SECRET",
  "WHATSAPP_ACCESS_TOKEN",
  "WHATSAPP_PHONE_NUMBER_ID",
  "WHATSAPP_BUSINESS_ACCOUNT_ID",
  "WHATSAPP_GRAPH_API_VERSION",
  "GROQ_API_KEY",
  "GROQ_MODEL",
  "INTERNAL_JOB_SECRET",
];
const optional = [
  "GITHUB_APP_ID",
  "GITHUB_APP_PRIVATE_KEY",
  "GITHUB_INSTALLATION_ID",
  "GITHUB_TOKEN",
  "ALLOW_DEV_GITHUB_TOKEN",
  "GITLAB_TOKEN",
  "GITLAB_BASE_URL",
  "EMAIL_ENCRYPTION_KEY",
];
const missing = required.filter((name) => !process.env[name]?.trim());
if (missing.length) {
  console.error(`Fill these local configuration values first: ${missing.join(", ")}`);
  process.exitCode = 1;
} else if (process.env.INTERNAL_JOB_SECRET.length < 32) {
  console.error("INTERNAL_JOB_SECRET must contain at least 32 characters.");
  process.exitCode = 1;
} else {
  const lines = [...required, ...optional]
    .filter((name) => process.env[name]?.trim())
    .map((name) => `${name}=${JSON.stringify(process.env[name])}`);
  try {
    await writeFile(
      ".env.edge",
      "# Server-only Edge secrets. Never commit this file.\n" + lines.join("\n") + "\n",
      { flag: process.argv.includes("--force") ? "w" : "wx", mode: 0o600 },
    );
    console.log(
      `Created ignored .env.edge with ${lines.length} settings. No secret values were printed.`,
    );
  } catch (error) {
    if (error.code === "EEXIST") {
      console.log(
        "Existing .env.edge was left unchanged; it may differ from .env. Run `npm run secrets:prepare -- --force` to regenerate it.",
      );
    } else {
      console.error("Could not create .env.edge. Check local file permissions.");
      process.exitCode = 1;
    }
  }
}
