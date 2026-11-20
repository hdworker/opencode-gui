import { describe, expect, it } from "vitest";
import { webAppUrl } from "./webapp";

const BASE = "http://127.0.0.1:4096";

describe("webAppUrl", () => {
  it("opens the newest workspace session", () => {
    expect(webAppUrl(BASE, "secret", "ses_1")).toBe(
      `${BASE}/server/aHR0cDovLzEyNy4wLjAuMTo0MDk2/session/ses_1?auth_token=b3BlbmNvZGU6c2VjcmV0`,
    );
  });

  it("falls back to the app root when the folder has no sessions", () => {
    expect(webAppUrl(BASE, "secret")).toBe(
      `${BASE}/?auth_token=b3BlbmNvZGU6c2VjcmV0`,
    );
  });

  it("omits the token when the service has no password", () => {
    expect(webAppUrl(BASE, undefined)).toBe(`${BASE}/`);
  });
});
