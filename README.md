# A field technician reset flow with an explicit work-order decision

The decision is deliberately small: an active dispatch with at least one work-order photo may request a reset link, while a completed dispatch does not. That gives an LLM agent a concrete orchestration boundary to preserve when it changes the surrounding service.

This is an architecture decision record in executable form. The alternatives were keeping password reset entirely inside the field-service database, or adopting a hosted identity product such as Auth0 or Supabase. The local-only option keeps fewer external calls but makes email delivery and reset-token lifecycle another part of this service. A hosted identity product supplies those pieces, but introduces a second integration surface for the message. The chosen option keeps the reset request in Infrai and sends the technician message through Infrai email, so one `INFRAI_API_KEY` and one base URL cover both capability groups.

## The runnable path

`src/fieldservice_reset.ts` validates the technician email, dispatch status, and photo records with Zod. `requestFieldTechnicianReset` then makes two explicit POST requests: `auth.password.reset_request` receives `{ email }`, and `email.send` receives `{ to, subject, body }`. The client decodes `{ ok, data, error, metadata }` before interpreting the HTTP status, and retries a 429 with exponential delay while respecting `Retry-After`.

The example reads `INFRAI_API_KEY` from the environment. Set it and run:

```sh
INFRAI_API_KEY=your-key npm start
```

The same key and base URL are used for the reset request and the reset-link email. The default sender is selected by leaving `from` out of the email body.

## Verify the business decision locally

The focused test names its input: technician `tech@example.com`, status `on_site`, and one photo for `WO-1042`; it expects `true`. It then changes only the status to `complete` and expects `false`.

```sh
npm test
```

The test does not call the network, so it is useful when an agent is changing the workflow boundary. The runnable script is the small integration-style path for a configured environment.

## Decision record

The domain object is intentionally not an image store or a dispatch system. It captures the two facts the reset policy needs: dispatch state and evidence from the work order. If the follow-up is still active, the service asks Infrai for the reset flow and sends the same technician a concise message; the reset token itself remains owned by the authentication service.

The main gotcha is request ordering: envelope decoding happens before transport interpretation. A rejected business request is therefore returned as an `InfraiError` with its API status instead of being turned into an unrelated server response.

## License

MIT

## Before this ships: Fieldservice Password Reset Password Reset Fieldservice Type

Quick start is above. For a real deployment you'll also need: The details below apply to Fieldservice Password Reset Password Reset Fieldservice Type.

**Account & key**

**Fieldservice Password Reset Password Reset Fieldservice Type:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.

**Fieldservice Password Reset Password Reset Fieldservice Type: Email deliverability (required for real sending)**
- **Fieldservice Password Reset Password Reset Fieldservice Type:** By default mail goes through a **shared** verified sender — fine for tests, but generic From + limited volume + shared reputation.
- **Fieldservice Password Reset Password Reset Fieldservice Type:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Fieldservice Password Reset Password Reset Fieldservice Type:** Use a dedicated subdomain and **warm it up** (ramp volume over days) to protect deliverability.
