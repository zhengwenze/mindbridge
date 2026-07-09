"use client";

import { App as AntdApp, ConfigProvider } from "antd";
import { QueryClientProvider } from "@tanstack/react-query";

import { AuthBootstrap } from "@/components/auth-bootstrap";
import { queryClient } from "@/lib/query/query-client";
import { antdTheme } from "@/lib/theme/antd-theme";

export function AppProviders({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider theme={antdTheme}>
        <AntdApp>
          <AuthBootstrap />
          {children}
        </AntdApp>
      </ConfigProvider>
    </QueryClientProvider>
  );
}
