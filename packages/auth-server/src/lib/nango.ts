import { Nango } from "@nangohq/node";

let nangoInstance: Nango | null = null;

export function getNango(): Nango {
  if (!nangoInstance) {
    const secretKey = process.env.NANGO_SECRET_KEY;
    if (!secretKey) {
      throw new Error("NANGO_SECRET_KEY environment variable is required");
    }
    nangoInstance = new Nango({ secretKey });
  }
  return nangoInstance;
}
