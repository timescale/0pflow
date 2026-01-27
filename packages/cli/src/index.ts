#!/usr/bin/env node
import { Command } from "commander";
import pc from "picocolors";
import { create0pflow } from "0pflow";
import { discoverWorkflows } from "./discovery.js";
import { resolveEnv } from "./env.js";

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
  .option("-i, --input <json>", "JSON input for the workflow", "{}")
  .option("--json", "Output result as JSON")
  .action(async (workflowName: string, options: { input: string; json?: boolean }) => {
    try {
      // Load environment (all .env vars into process.env)
      resolveEnv();

      // Discover workflows
      const { workflows, warnings } = await discoverWorkflows(process.cwd());

      // Always show warnings on stderr
      for (const warning of warnings) {
        console.error(pc.yellow(`Warning: ${warning}`));
      }

      const workflow = workflows.find(w => w.name === workflowName);

      if (!workflow) {
        console.error(pc.red(`Workflow "${workflowName}" not found`));
        console.log(pc.dim(`Available: ${workflows.map(w => w.name).join(", ")}`));
        process.exit(1);
      }

      // Parse input JSON
      let rawInput: unknown;
      try {
        rawInput = JSON.parse(options.input);
      } catch {
        console.error(pc.red("Invalid JSON input"));
        process.exit(1);
      }

      // Validate input against workflow schema
      const validation = workflow.inputSchema.safeParse(rawInput);
      if (!validation.success) {
        console.error(pc.red("Invalid workflow input:"));
        for (const issue of validation.error.issues) {
          const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
          console.error(pc.red(`  ${path}: ${issue.message}`));
        }
        process.exit(1);
      }
      const inputs = validation.data;

      // Build workflow registry from all discovered workflows
      const workflowRegistry = Object.fromEntries(
        workflows.map(w => [w.name, w])
      );

      // Create 0pflow instance and run
      if (!options.json) {
        console.log(pc.dim(`Running ${workflowName}...`));
      }

      const pflow = await create0pflow({
        databaseUrl: process.env.DATABASE_URL!,
        workflows: workflowRegistry,
      });

      try {
        const result = await pflow.triggerWorkflow(workflow.name, inputs);

        if (options.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log(pc.green("\nResult:"));
          console.log(JSON.stringify(result, null, 2));
        }
      } finally {
        await pflow.shutdown();
      }
    } catch (err) {
      console.error(pc.red(`Error: ${err instanceof Error ? err.message : err}`));
      process.exit(1);
    }
  });

program
  .command("compile")
  .description("Compile workflow specs to TypeScript")
  .action(async () => {
    console.log("Compiling specs... (not yet implemented)");
  });

program.parse();
