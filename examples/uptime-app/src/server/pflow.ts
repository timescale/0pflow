import { create0pflow } from "0pflow";
import { workflows, agents, nodes } from "../../generated/registry";

// Initialize 0pflow with statically-imported executables
export const pflow = await create0pflow({
  databaseUrl: process.env.DATABASE_URL!,
  appName: "uptime_app",
  workflows,
  agents,
  nodes,
});
