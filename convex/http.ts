import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";

/**
 * HTTP Authentication Bridge for Clerk + Convex
 * 
 * This endpoint handles JWT validation without requiring the `aud` (audience) claim.
 * Use this as a workaround while configuring the Clerk JWT template to include audience.
 * 
 * POST /convex-auth-bridge
 * Headers: Authorization: Bearer <clerk-jwt-token>
 * Body: { "action": "saveWorkflow", "payload": {...} }
 */

const http = httpRouter();

export default http;
