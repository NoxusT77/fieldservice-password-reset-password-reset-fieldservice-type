import assert from "node:assert/strict";
import { shouldSendResetLink, followUpRequest } from "./fieldservice_reset.ts";

const input = followUpRequest.parse({
  technicianEmail: "tech@example.com",
  dispatchStatus: "on_site",
  photos: [{ workOrderId: "WO-1042", caption: "Panel before repair", capturedAt: "2026-10-25T09:00:00.000Z" }],
});

assert.equal(shouldSendResetLink(input), true);
assert.equal(shouldSendResetLink({ ...input, dispatchStatus: "complete" }), false);
console.log("reset decision: an active photographed work order sends; a complete one does not");
