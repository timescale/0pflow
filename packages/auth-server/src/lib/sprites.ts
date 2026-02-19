/**
 * Internal Sprites (Fly.io) REST API client.
 *
 * The auth-server holds a single platform Sprites API token.
 * All user apps are deployed as namespaced Sprites under this account.
 * The token NEVER leaves the server.
 */

const SPRITES_API_BASE = "https://api.sprites.dev";

function getToken(): string {
  const token = process.env.SPRITES_API_TOKEN;
  if (!token) {
    throw new Error(
      "SPRITES_API_TOKEN not configured. See deployment docs for setup.",
    );
  }
  return token;
}

/**
 * Make an authenticated REST API call to Sprites.
 */
async function spritesApiCall(
  method: string,
  path: string,
  options?: {
    body?: unknown;
    rawBody?: Buffer | string;
    contentType?: string;
  },
): Promise<Response> {
  const token = getToken();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };

  let body: BodyInit | undefined;
  if (options?.rawBody !== undefined) {
    headers["Content-Type"] = options.contentType ?? "application/octet-stream";
    body = typeof options.rawBody === "string"
      ? options.rawBody
      : new Blob([options.rawBody as unknown as ArrayBuffer]);
  } else if (options?.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }

  const url = `${SPRITES_API_BASE}${path}`;
  const maxRetries = 5;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, { method, headers, body });

    if ((response.status === 502 || response.status === 503) && attempt < maxRetries) {
      const retryBody = await response.text();
      console.log(
        `[sprites] ${response.status} on ${method} ${path} (attempt ${attempt}/${maxRetries}): ${retryBody}`,
      );
      console.log(`[sprites] Retrying in ${attempt * 3}s...`);
      await new Promise((r) => setTimeout(r, attempt * 3000));
      continue;
    }

    if (response.status === 502 || response.status === 503) {
      console.log(`[sprites] ${response.status} on ${method} ${path} after ${maxRetries} attempts, giving up`);
    }

    return response;
  }

  // Unreachable, but TypeScript needs it
  throw new Error("Unexpected end of retry loop");
}

// ── Sprite CRUD ──────────────────────────────────────────────────

export interface SpriteInfo {
  id: string;
  name: string;
  url?: string;
  status: string;
}

/**
 * Create a new Sprite. Returns sprite info including public URL.
 */
export async function createSprite(name: string): Promise<SpriteInfo> {
  const response = await spritesApiCall("POST", "/v1/sprites", {
    body: {
      name,
      wait_for_capacity: true,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Failed to create sprite "${name}" (${response.status}): ${text}`,
    );
  }

  return (await response.json()) as SpriteInfo;
}

/**
 * Get info for an existing Sprite. Returns null if not found.
 */
export async function getSprite(name: string): Promise<SpriteInfo | null> {
  const response = await spritesApiCall("GET", `/v1/sprites/${encodeURIComponent(name)}`);

  if (response.status === 404) return null;

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Failed to get sprite "${name}" (${response.status}): ${text}`,
    );
  }

  return (await response.json()) as SpriteInfo;
}

/**
 * Update Sprite settings (e.g. make URL public).
 */
export async function updateSprite(
  name: string,
  settings: { url_settings?: { auth: string } },
): Promise<void> {
  const response = await spritesApiCall(
    "PUT",
    `/v1/sprites/${encodeURIComponent(name)}`,
    { body: settings },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Failed to update sprite "${name}" (${response.status}): ${text}`,
    );
  }
}

// ── Wake ─────────────────────────────────────────────────────────

/**
 * Wake a Sprite from hibernation by making a lightweight API call.
 * Listing exec sessions triggers the Sprite to wake up.
 * Retries until the API responds successfully.
 */
export async function wakeSprite(spriteName: string): Promise<void> {
  const token = getToken();
  const url = `${SPRITES_API_BASE}/v1/sprites/${encodeURIComponent(spriteName)}/exec`;
  const maxAttempts = 10;

  for (let i = 1; i <= maxAttempts; i++) {
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(10000),
      });
      console.log(`[sprites] Wake ${spriteName} attempt ${i}: ${res.status}`);
      if (res.status !== 502 && res.status !== 503) {
        return; // Sprite is awake
      }
    } catch (err) {
      console.log(
        `[sprites] Wake ${spriteName} attempt ${i}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  console.log(`[sprites] Wake ${spriteName}: gave up after ${maxAttempts} attempts, proceeding anyway`);
}

// ── Filesystem ───────────────────────────────────────────────────

/**
 * Write a file to the Sprite's filesystem.
 */
export async function writeFile(
  spriteName: string,
  filePath: string,
  data: Buffer | string,
  mode?: string,
): Promise<void> {
  const params = new URLSearchParams({
    path: filePath,
    mkdir: "true",
  });
  if (mode) params.set("mode", mode);

  const response = await spritesApiCall(
    "PUT",
    `/v1/sprites/${encodeURIComponent(spriteName)}/fs/write?${params}`,
    {
      rawBody: typeof data === "string" ? Buffer.from(data) : data,
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Failed to write file "${filePath}" on sprite "${spriteName}" (${response.status}): ${text}`,
    );
  }
}

/**
 * Read a file from the Sprite's filesystem.
 * Returns null if the file doesn't exist (404).
 */
export async function readFile(
  spriteName: string,
  filePath: string,
): Promise<Buffer | null> {
  const params = new URLSearchParams({ path: filePath });

  const response = await spritesApiCall(
    "GET",
    `/v1/sprites/${encodeURIComponent(spriteName)}/fs/read?${params}`,
  );

  if (response.status === 404) return null;

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Failed to read file "${filePath}" on sprite "${spriteName}" (${response.status}): ${text}`,
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// ── Exec ─────────────────────────────────────────────────────────

/**
 * Execute a command in the background on the Sprite.
 * The command is wrapped with `nohup ... &` so it returns immediately.
 */
export async function execBackground(
  spriteName: string,
  command: string,
): Promise<void> {
  const wrappedCmd = `bash -c "nohup ${command} > /tmp/build-out.log 2>&1 &"`;
  const params = new URLSearchParams({ cmd: wrappedCmd });

  const response = await spritesApiCall(
    "POST",
    `/v1/sprites/${encodeURIComponent(spriteName)}/exec?${params}`,
    { rawBody: "" },
  );

  // The exec endpoint may return streaming data; we don't need to wait for it
  if (!response.ok && response.status !== 101) {
    const text = await response.text();
    throw new Error(
      `Failed to exec on sprite "${spriteName}" (${response.status}): ${text}`,
    );
  }
}

// ── Services ─────────────────────────────────────────────────────

/**
 * Create or update a service definition on the Sprite.
 */
export async function putService(
  spriteName: string,
  serviceName: string,
  config: { cmd: string; args?: string[]; http_port?: number },
): Promise<void> {
  const response = await spritesApiCall(
    "PUT",
    `/v1/sprites/${encodeURIComponent(spriteName)}/services/${encodeURIComponent(serviceName)}`,
    { body: config },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Failed to put service "${serviceName}" on sprite "${spriteName}" (${response.status}): ${text}`,
    );
  }
}

/**
 * Start a service. The response is streaming NDJSON — we consume it
 * but don't wait for the stream to finish (fire-and-forget).
 */
export async function startService(
  spriteName: string,
  serviceName: string,
): Promise<void> {
  const response = await spritesApiCall(
    "POST",
    `/v1/sprites/${encodeURIComponent(spriteName)}/services/${encodeURIComponent(serviceName)}/start`,
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Failed to start service "${serviceName}" on sprite "${spriteName}" (${response.status}): ${text}`,
    );
  }

  // Don't await the streaming body — let the service run
}

/**
 * Stop a service.
 */
export async function stopService(
  spriteName: string,
  serviceName: string,
): Promise<void> {
  const response = await spritesApiCall(
    "POST",
    `/v1/sprites/${encodeURIComponent(spriteName)}/services/${encodeURIComponent(serviceName)}/stop`,
  );

  // 404 = service doesn't exist, that's fine
  if (!response.ok && response.status !== 404) {
    const text = await response.text();
    throw new Error(
      `Failed to stop service "${serviceName}" on sprite "${spriteName}" (${response.status}): ${text}`,
    );
  }
}

/**
 * Delete a service definition.
 */
export async function deleteService(
  spriteName: string,
  serviceName: string,
): Promise<void> {
  const response = await spritesApiCall(
    "DELETE",
    `/v1/sprites/${encodeURIComponent(spriteName)}/services/${encodeURIComponent(serviceName)}`,
  );

  if (!response.ok && response.status !== 404) {
    const text = await response.text();
    throw new Error(
      `Failed to delete service "${serviceName}" on sprite "${spriteName}" (${response.status}): ${text}`,
    );
  }
}

export interface ServiceInfo {
  name: string;
  cmd: string;
  args?: string[];
  http_port?: number;
  state?: {
    name: string;
    status: string;
    pid?: number;
    restart_count?: number;
  };
}

/**
 * Get info for a specific service. Returns null if not found.
 */
export async function getService(
  spriteName: string,
  serviceName: string,
): Promise<ServiceInfo | null> {
  const response = await spritesApiCall(
    "GET",
    `/v1/sprites/${encodeURIComponent(spriteName)}/services/${encodeURIComponent(serviceName)}`,
  );

  if (response.status === 404) return null;

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Failed to get service "${serviceName}" on sprite "${spriteName}" (${response.status}): ${text}`,
    );
  }

  return (await response.json()) as ServiceInfo;
}

/**
 * Get logs for a service. Returns the log content as a string.
 */
export async function getServiceLogs(
  spriteName: string,
  serviceName: string,
): Promise<string> {
  const response = await spritesApiCall(
    "GET",
    `/v1/sprites/${encodeURIComponent(spriteName)}/services/${encodeURIComponent(serviceName)}/logs`,
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Failed to get logs for "${serviceName}" on sprite "${spriteName}" (${response.status}): ${text}`,
    );
  }

  // Logs endpoint returns NDJSON stream; collect all lines
  const text = await response.text();
  const lines = text
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => {
      try {
        const event = JSON.parse(l) as { type?: string; data?: string };
        if (event.type === "stdout" || event.type === "stderr") {
          return event.data ?? "";
        }
        return "";
      } catch {
        return l;
      }
    })
    .filter((l) => l);

  return lines.join("\n");
}
