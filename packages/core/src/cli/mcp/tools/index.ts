import { createAppFactory } from "./createApp.js";
import { createDatabaseFactory } from "./createDatabase.js";
import { setupAppSchemaFactory } from "./setupAppSchema.js";
import { listIntegrationsFactory } from "./listIntegrations.js";
import { getConnectionInfoFactory } from "./getConnectionInfo.js";
import { startDevUiFactory } from "./startDevUi.js";

export async function getApiFactories() {
  return [
    createAppFactory,
    createDatabaseFactory,
    setupAppSchemaFactory,
    listIntegrationsFactory,
    getConnectionInfoFactory,
    startDevUiFactory,
  ] as const;
}
