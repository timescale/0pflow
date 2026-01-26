// packages/core/src/dbos.ts
import { DBOS } from "@dbos-inc/dbos-sdk";

export interface DBOSConfig {
  databaseUrl: string;
  appName?: string;
}

/**
 * Initialize DBOS with the given configuration
 */
export async function initializeDBOS(config: DBOSConfig): Promise<void> {
  DBOS.setConfig({
    name: config.appName ?? "0pflow",
    systemDatabaseUrl: config.databaseUrl,
  });
  await DBOS.launch();
}

/**
 * Shutdown DBOS gracefully
 */
export async function shutdownDBOS(): Promise<void> {
  await DBOS.shutdown();
}
