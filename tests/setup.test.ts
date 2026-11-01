import { afterEach, describe, expect, it, vi } from "vitest";
import { scryptSync } from "node:crypto";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const database = vi.hoisted(() => ({
  options: vi.fn(),
  query: vi.fn().mockResolvedValue(undefined),
  end: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("pg", () => ({
  Pool: class {
    constructor(options: { connectionString: string }) { database.options(options); }
    query = database.query;
    end = database.end;
  },
}));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  vi.resetModules();
});

describe("safe production setup tools", () => {
  it("hashes an exact password from stdin without echoing it", () => {
    const password = "  setup-test-password-\u00fc-with-spaces  ";
    const result = spawnSync(process.execPath, [resolve("scripts", "password.mjs"), "--stdin"], { input: `${password}\r\n`, encoding: "utf8" });
    expect(result.status).toBe(0);
    expect(result.stdout).not.toContain(password);
    const [salt, hash] = result.stdout.trim().split(":");
    expect(salt).toMatch(/^[a-f0-9]{32}$/);
    expect(hash).toBe(scryptSync(password, salt, 64).toString("hex"));
  });
  it("rejects a short stdin password without echoing it", () => {
    const result = spawnSync(process.execPath, [resolve("scripts", "password.mjs"), "--stdin"], { input: "short\n", encoding: "utf8" });
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("at least 14 characters");
  });
  it("retains compatibility with existing positional-password usage", () => {
    const result = spawnSync(process.execPath, [resolve("scripts", "password.mjs"), "setup-test-password"], { encoding: "utf8" });
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toMatch(/^[a-f0-9]{32}:[a-f0-9]{128}$/);
  });
  it("uses the direct database connection for migrations and closes it", async () => {
    vi.stubEnv("DIRECT_DATABASE_URL", "postgresql://direct.example.invalid/test");
    vi.stubEnv("DATABASE_URL", "postgresql://pooled.example.invalid/test");
    await import("../scripts/migrate");
    expect(database.options).toHaveBeenCalledWith({ connectionString: "postgresql://direct.example.invalid/test" });
    expect(database.query).toHaveBeenCalledOnce();
    expect(database.end).toHaveBeenCalledOnce();
  });
  it("preserves the database URL fallback for existing installations", async () => {
    vi.stubEnv("DIRECT_DATABASE_URL", "");
    vi.stubEnv("DATABASE_URL", "postgresql://pooled.example.invalid/test");
    await import("../scripts/migrate");
    expect(database.options).toHaveBeenCalledWith({ connectionString: "postgresql://pooled.example.invalid/test" });
  });
  it("explicitly rejects missing migration credentials", async () => {
    vi.stubEnv("DIRECT_DATABASE_URL", "");
    vi.stubEnv("DATABASE_URL", "");
    await expect(import("../scripts/migrate")).rejects.toThrow("DIRECT_DATABASE_URL or DATABASE_URL is required");
    expect(database.options).not.toHaveBeenCalled();
  });
});
