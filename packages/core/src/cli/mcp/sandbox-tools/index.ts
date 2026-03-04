import { readFileFactory } from "./readFile.js";
import { writeFileFactory } from "./writeFile.js";
import { editFileFactory } from "./editFile.js";
import { listDirectoryFactory } from "./listDirectory.js";
import { bashFactory } from "./bash.js";

export async function getSandboxApiFactories() {
  return [
    readFileFactory,
    writeFileFactory,
    editFileFactory,
    listDirectoryFactory,
    bashFactory,
  ] as const;
}
