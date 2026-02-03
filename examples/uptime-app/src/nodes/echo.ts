// A simple echo node for testing
import { z } from "zod";
import { Node } from "0pflow";

export const echoNode = Node.create({
  name: "echo",
  description: "Echoes back the input message",
  inputSchema: z.object({
    message: z.string(),
  }),
  outputSchema: z.object({
    echoed: z.string(),
  }),
  execute: async (_ctx, inputs) => {
    return { echoed: `Echo: ${inputs.message}` };
  },
});
