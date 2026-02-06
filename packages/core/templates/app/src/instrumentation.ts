export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getPflow } = await import("~/lib/pflow");
    await getPflow();
  }
}
