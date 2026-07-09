"use client";

import {
  AuditOutlined,
  BookOutlined,
  CommentOutlined,
  DashboardOutlined,
  FileTextOutlined,
  SafetyOutlined
} from "@ant-design/icons";
import { Menu, Typography } from "antd";
import type { MenuProps } from "antd";
import { usePathname } from "next/navigation";

import { useUiStore } from "@/stores/use-ui-store";

interface SidebarPlaceholderProps {
  workspace: "student" | "admin";
}

const studentItems: MenuProps["items"] = [
  {
    key: "/student",
    icon: <CommentOutlined />,
    label: "陪伴对话"
  }
];

const adminItems: MenuProps["items"] = [
  {
    key: "/admin",
    icon: <DashboardOutlined />,
    label: "概览"
  },
  {
    key: "reports",
    icon: <FileTextOutlined />,
    label: "风险报告"
  },
  {
    key: "cases",
    icon: <SafetyOutlined />,
    label: "风险个案"
  },
  {
    key: "knowledge",
    icon: <BookOutlined />,
    label: "知识库"
  },
  {
    key: "trace",
    icon: <AuditOutlined />,
    label: "Agent Trace"
  }
];

export function SidebarPlaceholder({ workspace }: SidebarPlaceholderProps) {
  const pathname = usePathname();
  const collapsed = useUiStore((state) => state.sidebarCollapsed);
  const items = workspace === "admin" ? adminItems : studentItems;

  return (
    <aside
      className="hidden shrink-0 overflow-hidden border-r border-slate-200 bg-white transition-[width] duration-200 md:block"
      style={{ width: collapsed ? 80 : 248 }}
    >
      <div className="flex h-16 items-center gap-3 border-b border-slate-200 px-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-teal-700 text-sm font-semibold text-white">
          MB
        </div>
        {!collapsed ? (
          <div className="min-w-0">
            <Typography.Text strong className="block truncate">
              MindBridge
            </Typography.Text>
            <Typography.Text className="block truncate !text-xs !text-slate-500">
              {workspace === "admin" ? "咨询管理后台" : "学生陪伴端"}
            </Typography.Text>
          </div>
        ) : null}
      </div>
      <div className="p-3">
        <Menu
          mode="inline"
          inlineCollapsed={collapsed}
          selectedKeys={[pathname]}
          items={items}
          className="mindbridge-sidebar-menu !border-0"
        />
      </div>
    </aside>
  );
}
