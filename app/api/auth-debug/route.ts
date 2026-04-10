import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

export const dynamic = 'force-dynamic';

/**
 * DEBUG ENDPOINT: JWT Token Inspector
 * 
 * This endpoint helps diagnose Convex auth issues by showing:
 * 1. The JWT token claims from Clerk
 * 2. Whether the token issuer matches Convex config
 * 3. The decoded payload for inspection
 */
export async function GET(request: NextRequest) {
  try {
    const { getToken } = await auth();

    // Try to get the Convex JWT template token
    let convexToken: string | null = null;
    let convexTokenError: string | null = null;
    
    try {
      convexToken = await getToken({ template: "convex" });
    } catch (err) {
      convexTokenError = err instanceof Error ? err.message : String(err);
    }

    // Try to get default token
    let defaultToken: string | null = null;
    let defaultTokenError: string | null = null;
    
    try {
      defaultToken = await getToken();
    } catch (err) {
      defaultTokenError = err instanceof Error ? err.message : String(err);
    }

    // Decode tokens to inspect claims
    const decodeToken = (token: string | null) => {
      if (!token) return null;
      try {
        const parts = token.split('.');
        if (parts.length !== 3) return { error: 'Invalid token format' };
        
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        return {
          iss: payload.iss,
          aud: payload.aud,
          sub: payload.sub,
          exp: new Date(payload.exp * 1000).toISOString(),
          iat: new Date(payload.iat * 1000).toISOString(),
          full: payload,
        };
      } catch (e) {
        return { error: 'Failed to decode token' };
      }
    };

    const convexTokenClaims = decodeToken(convexToken);
    const defaultTokenClaims = decodeToken(defaultToken);

    // Get expected Clerk domain
    const clerkDomain = process.env.CONVEX_CLERK_DOMAIN || "https://supreme-fowl-49.clerk.accounts.dev";

    return NextResponse.json(
      {
        status: 'authenticated',
        convex_token: {
          present: !!convexToken,
          error: convexTokenError,
          claims: convexTokenClaims,
        },
        default_token: {
          present: !!defaultToken,
          error: defaultTokenError,
          claims: defaultTokenClaims,
        },
        expected_config: {
          clerk_domain: clerkDomain,
          application_id: 'convex',
          note: 'These should match the JWT issuer domain above',
        },
        diagnostics: {
          convex_token_issuer_match: convexTokenClaims?.iss === clerkDomain,
          issue: convexTokenClaims?.iss !== clerkDomain 
            ? `JWT issuer mismatch: Got "${convexTokenClaims?.iss}" but expected "${clerkDomain}". Update CONVEX_CLERK_DOMAIN in Convex dashboard.`
            : 'Configuration appears correct',
        },
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
        hint: 'Make sure you are logged in and the auth context is available',
      },
      { status: 401 }
    );
  }
}
