"use client";

import { useState } from "react";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";

interface ProvidersProps {
  children: React.ReactNode;
}

/**
 * Root application providers wrapper.
 * Wraps the component tree with:
 * - next-themes ThemeProvider for dark/light/system theme support
 * - NextAuth's SessionProvider for client-side session access
 * - TanStack Query's QueryClientProvider for data fetching/caching
 * - Sonner's Toaster for toast notifications
 * @param children - The application component tree
 */
export function Providers({ children }: ProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          {children}
          <Toaster
            richColors
            closeButton
            position="top-right"
            visibleToasts={5}
            duration={5000}
          />
        </SessionProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
