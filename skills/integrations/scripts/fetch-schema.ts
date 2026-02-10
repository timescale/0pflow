// fetch-schema.ts
// Fetches and cleans the Salesforce GraphQL schema
//
// Two modes:
//   1. Nango: --nango-connection-id <id> (fetches domain + token from Nango automatically)
//   2. Manual: --domain <url> (uses SALESFORCE_ACCESS_TOKEN or client credentials from .env)
//
// Both modes require --output <path> for the cleaned schema file.
//
// Usage:
//   npx tsx fetch-schema.ts --nango-connection-id <id> --output <path>
//   npx tsx fetch-schema.ts --domain <url> --output <path>

import { config } from "dotenv";
import findConfig from "find-config";
import { writeFileSync, readFileSync, mkdirSync } from "fs";
import { getIntrospectionQuery } from "graphql";
import he from "he";

// Load .env from current or parent directories
const envPath = findConfig(".env");
if (envPath) {
  console.log(`Loading environment from ${envPath}`);
  config({ path: envPath });
} else {
  console.log("No .env file found, using existing environment variables");
}

// --- Arg parsing ---

interface Args {
  nangoConnectionId?: string;
  domain?: string;
  output: string;
}

function parseArgs(): Args {
  const args: Partial<Args> = {};
  for (let i = 2; i < process.argv.length; i++) {
    switch (process.argv[i]) {
      case "--nango-connection-id":
        args.nangoConnectionId = process.argv[++i];
        break;
      case "--domain":
        args.domain = process.argv[++i];
        break;
      case "--output":
        args.output = process.argv[++i];
        break;
      default:
        console.error(`Unknown argument: ${process.argv[i]}`);
        printUsage();
        process.exit(1);
    }
  }

  if (!args.output) {
    console.error("Error: --output is required");
    printUsage();
    process.exit(1);
  }

  if (!args.nangoConnectionId && !args.domain && !process.env.SALESFORCE_DOMAIN) {
    console.error("Error: either --nango-connection-id or --domain is required");
    printUsage();
    process.exit(1);
  }

  // Fall back to env var for domain
  if (!args.nangoConnectionId && !args.domain) {
    args.domain = process.env.SALESFORCE_DOMAIN;
  }

  return args as Args;
}

function printUsage(): void {
  console.error(`
Usage:
  npx tsx fetch-schema.ts --nango-connection-id <id> --output <path>
  npx tsx fetch-schema.ts --domain <url> --output <path>

Options:
  --nango-connection-id <id>  Fetch domain and token from Nango (preferred)
  --domain <url>              Salesforce instance URL (for non-Nango auth)
  --output <path>             Output path for cleaned schema JSON (required)

Environment variables (for --domain mode):
  SALESFORCE_DOMAIN            Fallback if --domain not provided
  SALESFORCE_ACCESS_TOKEN      Direct access token
  SALESFORCE_CLIENT_ID +       Client credentials OAuth flow
  SALESFORCE_CLIENT_SECRET
`);
}

// --- Schema helpers ---

interface EnumValue {
  name: string;
  description: string | null;
  isDeprecated: boolean;
  deprecationReason: string | null;
}

interface SchemaType {
  kind: string;
  name: string;
  enumValues: EnumValue[] | null;
}

function decodeHtmlEntities(obj: unknown): void {
  if (!obj || typeof obj !== "object") return;

  for (const key of Object.keys(obj)) {
    const value = (obj as Record<string, unknown>)[key];

    if (typeof value === "string") {
      (obj as Record<string, unknown>)[key] = he.decode(value);
    } else if (Array.isArray(value)) {
      value.forEach((item) => decodeHtmlEntities(item));
    } else if (typeof value === "object") {
      decodeHtmlEntities(value);
    }
  }
}

function fixEmptyEnums(schema: { data: { __schema: { types: SchemaType[] } } }): number {
  let fixed = 0;
  for (const type of schema.data.__schema.types) {
    if (type.kind === "ENUM" && (type.enumValues === null || type.enumValues.length === 0)) {
      type.enumValues = [{
        name: "_EMPTY",
        description: "Placeholder for empty enum",
        isDeprecated: true,
        deprecationReason: "Empty enum placeholder"
      }];
      fixed++;
      console.log(`  Fixed empty enum: ${type.name}`);
    }
  }
  return fixed;
}

// --- Auth methods ---

async function getCredentialsFromNango(connectionId: string): Promise<{ accessToken: string; instanceUrl: string }> {
  const nangoSecretKey = process.env.NANGO_SECRET_KEY;
  if (!nangoSecretKey) {
    throw new Error("NANGO_SECRET_KEY not found in .env. Required when using --nango-connection-id.");
  }

  const { Nango } = await import("@nangohq/node");
  const nango = new Nango({ secretKey: nangoSecretKey });
  const connection = await nango.getConnection("salesforce", connectionId);

  const creds = (connection.credentials ?? {}) as Record<string, unknown>;
  const accessToken = (creds.access_token ?? creds.api_key ?? creds.token) as string | undefined;
  const connConfig = (connection.connection_config ?? {}) as Record<string, unknown>;
  const instanceUrl = connConfig.instance_url as string | undefined;

  if (!accessToken) {
    throw new Error("No access token found in Nango connection credentials.");
  }
  if (!instanceUrl) {
    throw new Error("No instance_url found in Nango connection config.");
  }

  return { accessToken, instanceUrl };
}

async function getAccessTokenViaClientCredentials(domain: string): Promise<{ accessToken: string; instanceUrl: string }> {
  const clientId = process.env.SALESFORCE_CLIENT_ID;
  const clientSecret = process.env.SALESFORCE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "No authentication method available.\n" +
      "Configure a Salesforce connection in the Dev UI (Nango), or\n" +
      "Set SALESFORCE_ACCESS_TOKEN for direct token auth, or\n" +
      "Set SALESFORCE_CLIENT_ID and SALESFORCE_CLIENT_SECRET for client credentials flow."
    );
  }

  console.log("Using client credentials OAuth flow...");
  const response = await fetch(`${domain}/services/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!response.ok) {
    throw new Error(`OAuth failed (${response.status}): ${await response.text()}`);
  }

  const data = (await response.json()) as { access_token: string; instance_url?: string };
  return {
    accessToken: data.access_token,
    instanceUrl: data.instance_url || domain,
  };
}

async function getAccessToken(args: Args): Promise<{ accessToken: string; instanceUrl: string }> {
  // Mode 1: Nango
  if (args.nangoConnectionId) {
    console.log(`Fetching credentials from Nango (connection: ${args.nangoConnectionId})...`);
    return getCredentialsFromNango(args.nangoConnectionId);
  }

  // Mode 2: Manual — direct token
  const directToken = process.env.SALESFORCE_ACCESS_TOKEN;
  if (directToken) {
    console.log("Using direct access token (SALESFORCE_ACCESS_TOKEN)...");
    return {
      accessToken: directToken,
      instanceUrl: args.domain!,
    };
  }

  // Mode 2: Manual — client credentials
  return getAccessTokenViaClientCredentials(args.domain!);
}

// --- Main ---

async function fetchGraphQLSchema(accessToken: string, instanceUrl: string): Promise<unknown> {
  const introspectionQuery = getIntrospectionQuery();

  const response = await fetch(`${instanceUrl}/services/data/v59.0/graphql`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: introspectionQuery }),
  });

  if (!response.ok) {
    throw new Error(`GraphQL introspection failed (${response.status}): ${await response.text()}`);
  }

  return response.json();
}

async function main() {
  const args = parseArgs();

  console.log("Getting access token...");
  const { accessToken, instanceUrl } = await getAccessToken(args);
  console.log(`Got token, instance URL: ${instanceUrl}`);

  console.log("Fetching GraphQL schema...");
  const schema = await fetchGraphQLSchema(accessToken, instanceUrl) as { data: { __schema: { types: SchemaType[] } } };

  console.log("Decoding HTML entities...");
  decodeHtmlEntities(schema);

  console.log("Fixing empty enums...");
  const fixedCount = fixEmptyEnums(schema);
  if (fixedCount === 0) {
    console.log("  No empty enums found");
  }

  // Ensure output directory exists
  const outputDir = args.output.substring(0, args.output.lastIndexOf("/"));
  if (outputDir) {
    mkdirSync(outputDir, { recursive: true });
  }

  writeFileSync(args.output, JSON.stringify(schema, null, 2));
  console.log(`Cleaned schema saved to ${args.output}`);

  // Verify JSON is valid
  JSON.parse(readFileSync(args.output, "utf-8"));
  console.log("JSON validation passed");
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
