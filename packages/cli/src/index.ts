#!/usr/bin/env node
import { Command } from "commander";
import pc from "picocolors";
import { discoverWorkflows } from "./discovery.js";

const program = new Command();

program
  .name("0pflow")
  .description("CLI for 0pflow workflow engine")
  .version("0.1.0");

program
  .command("list")
  .description("List all available workflows")
  .option("--json", "Output as JSON")
  .action(async (options: { json?: boolean }) => {
    try {
      const { workflows, warnings } = await discoverWorkflows(process.cwd());

      // Always show warnings on stderr (doesn't pollute stdout for JSON parsing)
      for (const warning of warnings) {
        console.error(pc.yellow(`Warning: ${warning}`));
      }

      if (workflows.length === 0) {
        if (options.json) {
          console.log("[]");
        } else {
          console.log(pc.yellow("No workflows found in generated/workflows/"));
        }
        return;
      }

      if (options.json) {
        const output = workflows.map(w => ({
          name: w.name,
          version: w.version,
        }));
        console.log(JSON.stringify(output, null, 2));
      } else {
        console.log(pc.bold("\nAvailable workflows:\n"));
        for (const w of workflows) {
          const version = w.version ? ` (v${w.version})` : "";
          console.log(`  ${pc.cyan(w.name)}${pc.dim(version)}`);
        }
        console.log();
      }
    } catch (err) {
      console.error(pc.red(`Error: ${err instanceof Error ? err.message : err}`));
      process.exit(1);
    }
  });

program
  .command("run <workflow>")
  .description("Run a workflow")
  .option("-i, --input <json>", "JSON input for the workflow")
  .action(async (workflow: string, options: { input?: string }) => {
    console.log(`Running workflow: ${workflow}`);
    if (options.input) {
      console.log(`Input: ${options.input}`);
    }
    console.log("(not yet implemented)");
  });

program
  .command("compile")
  .description("Compile workflow specs to TypeScript")
  .action(async () => {
    console.log("Compiling specs... (not yet implemented)");
  });

program.parse();
