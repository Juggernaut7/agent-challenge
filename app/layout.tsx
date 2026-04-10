"use client";

import { GeistMono } from "geist/font/mono";
import { Roboto_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { ClerkProvider, useAuth } from '@clerk/nextjs';
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient } from "convex/react";
import ColorStyles from "@/components/shared/color-styles/color-styles";
import Scrollbar from "@/components/ui/scrollbar";
import { BigIntProvider } from "@/components/providers/BigIntProvider";
import "styles/main.css";

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;

if (!CONVEX_URL) {
  console.error("Missing NEXT_PUBLIC_CONVEX_URL environment variable.");
}

const convex = CONVEX_URL ? new ConvexReactClient(CONVEX_URL) : null;


const robotoMono = Roboto_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-roboto-mono",
});

// Metadata must be in a separate server component
// For now, set via document head

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const content = (
    <html lang="en">
      <head>
        <title>ElizaForge | Personal AI Operating System</title>
        <meta name="description" content="A Personal Multi-Agent AI Assistant with Visual Workflow Control. Powered by ElizaOS and Nosana." />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="icon" href="/favicon.png" type="image/png" />
        <ColorStyles />
      </head>
      <body
        className={`${GeistMono.variable} ${robotoMono.variable} font-sans text-text-primary bg-main-bg overflow-x-clip`}
      >
        <BigIntProvider>
          <main className="overflow-x-clip">{children}</main>
          <Scrollbar />
          <Toaster position="bottom-right" />
        </BigIntProvider>
      </body>
    </html>
  );

  if (!convex) {
    return (
      <html lang="en">
        <body className="bg-main-bg flex items-center justify-center min-h-screen p-24">
          <div className="max-w-md w-full bg-white/5 backdrop-blur-md border border-red-500/20 rounded-16 p-32 text-center">
            <h1 className="text-2xl font-bold text-red-500 mb-16">Configuration Required</h1>
            <p className="text-muted-foreground mb-24">
              `NEXT_PUBLIC_CONVEX_URL` is missing. Please create a `.env.local` file from `.env.example` and add your Convex URL.
            </p>
            <div className="bg-black/20 p-16 rounded-8 text-left text-sm font-mono overflow-x-auto">
              NEXT_PUBLIC_CONVEX_URL=https://your-app.convex.cloud
            </div>
          </div>
        </body>
      </html>
    );
  }

  return (
    <ClerkProvider>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        {content}
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}

