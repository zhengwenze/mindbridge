"use client";

import { Layout } from "antd";

import { GlobalHeader } from "./global-header";
import { SidebarPlaceholder } from "./sidebar-placeholder";

interface AppShellProps {
  workspace: "student" | "admin";
  children: React.ReactNode;
}

export function AppShell({ workspace, children }: AppShellProps) {
  return (
    <Layout className="min-h-screen !bg-slate-50">
      <div className="flex min-h-screen w-full">
        <SidebarPlaceholder workspace={workspace} />
        <div className="flex min-w-0 flex-1 flex-col">
          <GlobalHeader workspace={workspace} />
          <Layout.Content className="min-w-0 flex-1">{children}</Layout.Content>
        </div>
      </div>
    </Layout>
  );
}
