import { create0pflow } from "0pflow";
import { workflows, agents, nodes } from "../../generated/registry";
import "server-only";

type PflowInstance = Awaited<ReturnType<typeof create0pflow>>;

let pflow: PflowInstance | null = null;
let initPromise: Promise<PflowInstance> | null = null;

export async function getPflow(): Promise<PflowInstance> {
  if (pflow) return pflow;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const instance = await create0pflow({
      databaseUrl: process.env.DATABASE_URL!,
      appName: "{{app_name}}",
      workflows,
      agents,
      nodes,
    });
    console.log("0pflow initialized");
    return instance;
  })();

  pflow = await initPromise;
  return pflow;
}
