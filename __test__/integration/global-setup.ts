import { execFileSync } from "node:child_process";
import { PostgreSqlContainer } from "@testcontainers/postgresql";

interface GlobalSetupContext {
  provide: (key: "databaseUrl", value: string) => void;
}

export default async function setup({ provide }: GlobalSetupContext) {
  const container = await new PostgreSqlContainer("postgres:16-alpine").start();
  const databaseUrl = container.getConnectionUri();

  try {
    execFileSync("npx", ["prisma", "db", "push", "--url", databaseUrl], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: "pipe",
    });
  } catch (error) {
    if (error instanceof Error && "stderr" in error) {
      console.error(String(error.stderr));
    }

    await container.stop();
    throw error;
  }

  provide("databaseUrl", databaseUrl);

  return async () => {
    await container.stop();
  };
}
