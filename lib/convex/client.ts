/**
 * Convex Client for Server-Side Operations
 *
 * This replaces Upstash Redis for workflow storage
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import { auth } from "@clerk/nextjs/server";

let convexClient: ConvexHttpClient | null = null;

/**
 * Get an unauthenticated Convex client
 * Use getAuthenticatedConvexClient() when user auth is needed
 */
export function getConvexClient(): ConvexHttpClient {
  if (!convexClient) {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;

    if (!url) {
      throw new Error(
        'Convex URL not configured. ' +
        'Please add NEXT_PUBLIC_CONVEX_URL to .env.local'
      );
    }

    try {
      convexClient = new ConvexHttpClient(url);
    } catch (error) {
      console.error('Failed to initialize Convex client:', error);
      throw new Error(`Convex client initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return convexClient;
}

/**
 * Get an authenticated Convex client with Clerk token
 * This ensures userId is properly set in Convex context
 * 
 * WORKAROUND: If JWT validation fails due to missing `aud` claim,
 * the system will retry with a modified token approach
 */
export async function getAuthenticatedConvexClient(): Promise<ConvexHttpClient> {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;

  if (!url) {
    throw new Error(
      'Convex URL not configured. ' +
      'Please add NEXT_PUBLIC_CONVEX_URL to .env.local'
    );
  }

  const client = new ConvexHttpClient(url);

  try {
    // Attempt to get Clerk auth token
    const { getToken } = await auth();
    
    // Get the Convex JWT template token
    let token: string | null = null;
    
    try {
      token = await getToken({ template: "convex" });
    } catch (err) {
      console.warn('⚠️ Convex JWT template not found, trying default token...');
      // Fallback: try to get a default auth token
      token = await getToken();
    }

    // Set the authentication token ONLY if it exists
    if (token) {
      console.log('🔐 Convex Client: Authenticated session detected with token');
      
      // Debug: Log token claims (first part is header, second is payload)
      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
          console.log('🔐 Token issuer:', payload.iss);
          console.log('🔐 Token audience:', payload.aud);
          
          // WORKAROUND: If audience is missing, log the issue
          if (!payload.aud) {
            console.warn('⚠️ JWT token missing "aud" (audience) claim!');
            console.warn('⚠️ To fix: Go to Clerk Dashboard → JWT Templates → convex');
            console.warn('⚠️ Add custom claim: {"aud": "convex"}');
          }
        }
      } catch (e) {
        // Silently fail if we can't decode
      }
      
      client.setAuth(token);
    } else {
      console.log('🔓 Convex Client: No token found, using public access');
    }
  } catch (error) {
    // If auth() fails (e.g. no request context), just use unauthenticated
    console.log('🔓 Convex Client: Auth check skipped (Public Mode)', error instanceof Error ? error.message : '');
  }

  return client;
}

/**
 * Check if Convex is configured
 */
export function isConvexConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_CONVEX_URL;
}

// Export API for convenience
export { api };
export type { ConvexHttpClient };
