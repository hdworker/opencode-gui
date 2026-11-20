import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const LOCAL_SERVICE_URL = "http://127.0.0.1:4096";

export interface OpenCodeServiceEndpoint {
  base: string;
  password?: string;
}

/**
 * The `opencode` background service currently registered on this machine.
 * The desktop app and `opencode serve` both publish it there.
 */
export function readOpenCodeService(): OpenCodeServiceEndpoint | undefined {
  const stateHome =
    process.env.XDG_STATE_HOME || join(homedir(), ".local", "state");
  try {
    const service = JSON.parse(
      readFileSync(join(stateHome, "opencode", "service.json"), "utf8"),
    ) as { url?: unknown; password?: unknown };
    if (typeof service.url !== "string") return undefined;
    return {
      base: service.url.replace(/\/+$/, ""),
      password:
        typeof service.password === "string" ? service.password : undefined,
    };
  } catch {
    return undefined;
  }
}

/**
 * URL of the web UI to embed. Opens the newest session of `directory`, so the
 * panel starts in the folder the user has open instead of the global overview.
 */
export async function openCodeWebAppUrl(directory: string | undefined) {
  const service = readOpenCodeService();
  const base = service?.base ?? LOCAL_SERVICE_URL;
  if (!service?.password) return webAppUrl(base, undefined);
  const sessionID = directory
    ? await newestWorkspaceSession(service.base, service.password, directory)
    : undefined;
  return webAppUrl(base, service.password, sessionID);
}

export function webAppUrl(
  base: string,
  password: string | undefined,
  sessionID?: string,
) {
  const query = password
    ? `?auth_token=${encodeURIComponent(authToken(password))}`
    : "";
  if (!sessionID) return `${base}/${query}`;
  return `${base}/server/${serverKey(base)}/session/${sessionID}${query}`;
}

// The app seeds its server list from this token, which is why it works across
// the webview's cross-site iframe where SameSite=Lax cookies are not sent.
function authToken(password: string) {
  return Buffer.from(`opencode:${password}`).toString("base64");
}

// Mirrors ServerConnection.key() + base64Encode() in the app's session route.
function serverKey(base: string) {
  return Buffer.from(base).toString("base64url");
}

async function newestWorkspaceSession(
  base: string,
  password: string,
  directory: string,
) {
  const headers = { Authorization: `Basic ${authToken(password)}` };
  const list = async (query: string) => {
    const response = await fetch(`${base}/api/session?${query}`, {
      headers,
      signal: AbortSignal.timeout(2000),
    });
    if (!response.ok) return [];
    const body = (await response.json()) as {
      data?: Array<{ id?: unknown; location?: { directory?: unknown } }>;
    };
    return Array.isArray(body.data) ? body.data : [];
  };

  try {
    const exact = await list(
      `limit=1&order=desc&archived=false&parentID=null&directory=${encodeURIComponent(directory)}`,
    );
    if (typeof exact[0]?.id === "string") return exact[0].id;

    // VS Code can report the folder in a different case than the directory a
    // session was created in, and the filter matches case-sensitively.
    const recent = await list("limit=100&order=desc&archived=false&parentID=null");
    const target = normalizePath(directory);
    const match = recent.find(
      (session) => normalizePath(session.location?.directory) === target,
    );
    return typeof match?.id === "string" ? match.id : undefined;
  } catch {
    return undefined;
  }
}

function normalizePath(value: unknown) {
  return typeof value === "string"
    ? value.replace(/\\/g, "/").toLowerCase()
    : "";
}
