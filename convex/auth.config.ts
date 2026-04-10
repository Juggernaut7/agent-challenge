/**
 * Convex Authentication Configuration - Clerk Integration
 *
 * ⚠️ IMPORTANT: NoAuthProvider Error Fix
 * =========================================
 * If you're seeing:
 * "No auth provider found matching the given token"
 *
 * This means Clerk's JWT issuer doesn't match the domain below.
 *
 * HOW TO FIX:
 * 1. Log in to: https://dashboard.clerk.com/
 * 2. Select your application
 * 3. Copy your "Clerk Domain" from API Keys section (looks like: your-org.clerk.accounts.dev)
 * 4. Update the 'domain' values below to match EXACTLY
 * 5. Ensure JWT Template "convex" exists in Clerk dashboard
 * 6. Run: npx convex dev (to sync the config)
 */

export default {
  providers: [
    {
      // Replace with YOUR actual Clerk domain (without https://)
      // Example: my-app.clerk.accounts.dev → https://my-app.clerk.accounts.dev
      domain: "https://supreme-fowl-49.clerk.accounts.dev",
      applicationID: "convex",
    },
    {
      // Also support with trailing slash for compatibility
      domain: "https://supreme-fowl-49.clerk.accounts.dev/",
      applicationID: "convex",
    },
  ],
};
