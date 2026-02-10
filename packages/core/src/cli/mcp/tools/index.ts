import { createAppFactory } from "./createApp.js";
import { createDatabaseFactory } from "./createDatabase.js";
import { setupAppSchemaFactory } from "./setupAppSchema.js";
import { listIntegrationsFactory } from "./listIntegrations.js";
import { getConnectionInfoFactory } from "./getConnectionInfo.js";

export async function getApiFactories() {
  return [
    createAppFactory,
    createDatabaseFactory,
    setupAppSchemaFactory,
    listIntegrationsFactory,
    getConnectionInfoFactory,
  ] as const;
}
