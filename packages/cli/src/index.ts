#!/usr/bin/env node
import { Command } from "commander";

const program = new Command();

program
  .name("0pflow")
  .description("CLI for 0pflow workflow engine")
  .version("0.1.0");

program
  .command("list")
  .description("List all available workflows")
  .action(async () => {
    console.log("Listing workflows... (not yet implemented)");
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
