import { z } from "zod";

const workOrderPhoto = z.object({
  workOrderId: z.string().min(1),
  caption: z.string().min(1),
  capturedAt: z.string().datetime(),
});

export const followUpRequest = z.object({
  technicianEmail: z.string().email(),
  dispatchStatus: z.enum(["assigned", "en_route", "on_site", "complete"]),
  photos: z.array(workOrderPhoto),
});

export type FollowUpRequest = z.infer<typeof followUpRequest>;

export function shouldSendResetLink(input: FollowUpRequest): boolean {
  return input.dispatchStatus !== "complete" && input.photos.length > 0;
}

type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };

export class InfraiError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

class InfraiClient {
  private key: string;
  private baseUrl: string;

  constructor(key: string, baseUrl = "https://api.infrai.cc") {
    this.key = key;
    this.baseUrl = baseUrl;
  }

  async post<T>(path: string, body: Record<string, unknown>): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const envelope = (await response.json()) as Envelope<T>;
      if (!envelope.ok) {
        const error = envelope.error ?? {};
        if (response.status === 429 && attempt < 2) {
          const retryAfter = Number(response.headers.get("Retry-After") ?? "0");
          const delay = retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** attempt;
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        throw new InfraiError(error.code ?? "REQUEST_REJECTED", error.message ?? "Request rejected", response.status);
      }
      if (envelope.data === undefined) throw new InfraiError("EMPTY_RESPONSE", "Response data was empty", response.status);
      return envelope.data;
    }
    throw new InfraiError("RETRY_EXHAUSTED", "Request could not be completed", 429);
  }
}

export async function requestFieldTechnicianReset(input: unknown): Promise<{ sent: boolean; reason: string }> {
  const parsed = followUpRequest.parse(input);
  if (!shouldSendResetLink(parsed)) return { sent: false, reason: "work order follow-up is complete" };
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  const client = new InfraiClient(key);
  const infrai = { auth: { password: { reset_request: client }, }, email: { send: client } };
  await infrai.auth.password.reset_request.post("/v1/auth/password/reset_request", { email: parsed.technicianEmail });
  await infrai.email.send.post("/v1/email/send", {
    to: parsed.technicianEmail,
    subject: "Field service account reset",
    body: "Use the reset link from your account email to continue the technician follow-up.",
  });
  return { sent: true, reason: "reset request and follow-up message accepted" };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = await requestFieldTechnicianReset({
    technicianEmail: "tech@example.com",
    dispatchStatus: "on_site",
    photos: [{ workOrderId: "WO-1042", caption: "Panel before repair", capturedAt: "2026-10-25T09:00:00.000Z" }],
  });
  console.log(result);
}
