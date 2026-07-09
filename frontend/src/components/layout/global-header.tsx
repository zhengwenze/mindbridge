"use client";

import { LogoutOutlined, MenuFoldOutlined, MenuUnfoldOutlined } from "@ant-design/icons";
import { Button, Tooltip, Typography } from "antd";

import { getProfileRole } from "@/lib/auth/permissions";
import { useAuthStore } from "@/stores/use-auth-store";
import { useUiStore } from "@/stores/use-ui-store";
import { useLogout } from "@/features/auth/hooks/use-logout";

import { GlobalStatusIndicators } from "./global-status-indicators";

interface GlobalHeaderProps {
  workspace: "student" | "admin";
}

export function GlobalHeader({ workspace }: GlobalHeaderProps) {
  const profile = useAuthStore((state) => state.profile);
  const sidebarCollapsed = useUiStore((state) => state.sidebarCollapsed);
  const setSidebarCollapsed = useUiStore((state) => state.setSidebarCollapsed);
  const logout = useLogout();
  const role = getProfileRole(profile);

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <Tooltip title={sidebarCollapsed ? "展开侧边栏" : "收起侧边栏"}>
          <Button
            aria-label={sidebarCollapsed ? "展开侧边栏" : "收起侧边栏"}
            icon={sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          />
        </Tooltip>
        <div className="min-w-0">
          <Typography.Text className="block !text-xs !text-slate-500">MindBridge</Typography.Text>
          <Typography.Text strong className="block truncate !text-base">
            {workspace === "admin" ? "咨询管理工作台" : "学生陪伴工作台"}
          </Typography.Text>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <GlobalStatusIndicators />
        <div className="hidden text-right sm:block">
          <Typography.Text className="block !text-sm">
            {profile?.displayName ?? profile?.username ?? "未登录"}
          </Typography.Text>
          <Typography.Text className="block !text-xs !text-slate-500">
            {role === "admin" ? "管理员" : "学生"}
          </Typography.Text>
        </div>
        <Tooltip title="退出登录">
          <Button aria-label="退出登录" icon={<LogoutOutlined />} onClick={logout} />
        </Tooltip>
      </div>
    </header>
  );
}
