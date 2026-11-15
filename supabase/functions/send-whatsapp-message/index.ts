import { z } from "zod";
import { internal } from "../_shared/runtime.ts";
import { deliver } from "../_shared/deliver.ts";
Deno.serve(async (req) => {
  if (!internal(req)) return new Response("Unauthorized", { status: 401 });
  if (req.method !== "POST")
    return new Response("Method not allowed", { status: 405 });
  try {
    const a = z
      .object({ jobId: z.uuid(), lease: z.uuid() })
      .strict()
      .parse(await req.json());
    return Response.json({ status: await deliver(a.jobId, a.lease) });
  } catch {
    return new Response("Delivery operation failed", { status: 500 });
  }
});
