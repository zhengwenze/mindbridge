"use client";

import { App as AntdApp, ConfigProvider } from "antd";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

import { antdTheme } from "@/lib/theme/antd-theme";

export function AppProviders({ children }: Readonly<{ children: React.ReactNode }>) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: 1,
            staleTime: 30_000
          }
        }
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider theme={antdTheme}>
        <AntdApp>{children}</AntdApp>
      </ConfigProvider>
    </QueryClientProvider>
  );
}
