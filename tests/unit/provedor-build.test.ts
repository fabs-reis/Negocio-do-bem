import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

it("não incorpora ID Vercel residual em build sem provedor", async () => {
  vi.stubEnv("DEPLOY_ENV", "");
  vi.stubEnv("VERCEL_ENV", "");
  vi.stubEnv("VERCEL_DEPLOYMENT_ID", "dpl_Residual123");
  const { default: config } = await import("../../next.config");
  expect(config.env?.BANCO_PREVIEW_PROVEDOR).toBe("");
  expect(config.env?.BANCO_PREVIEW_ID).toBe("");
});
