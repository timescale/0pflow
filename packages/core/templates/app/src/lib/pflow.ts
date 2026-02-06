import { create0pflow, discover } from "0pflow";
import "server-only";

type PflowInstance = Awaited<ReturnType<typeof create0pflow>>;

let pflow: PflowInstance | null = null;
let initPromise: Promise<PflowInstance> | null = null;

export async function getPflow(): Promise<PflowInstance> {
  if (pflow) return pflow;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const discovered = await discover(process.cwd());
    if (discovered.warnings.length > 0) {
      console.warn("0pflow discovery warnings:", discovered.warnings);
    }
    const instance = await create0pflow({
      databaseUrl: process.env.DATABASE_URL!,
      appName: "{{app_name}}",
      ...discovered,
    });
    console.log("0pflow initialized");
    return instance;
  })();

  pflow = await initPromise;
  return pflow;
}
