"use client";

import {
  BookOutlined,
  BellOutlined,
  CommentOutlined,
  DashboardOutlined,
  FileExcelOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  HistoryOutlined,
  SafetyOutlined,
  SwapOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Menu, Typography } from "antd";
import type { MenuProps } from "antd";
import { usePathname, useRouter } from "next/navigation";
import { useUiStore } from "@/stores/use-ui-store";

interface SidebarPlaceholderProps {
  workspace: "student" | "admin";
}

const studentItems: MenuProps["items"] = [
  {
    key: "/student",
    icon: <CommentOutlined />,
    label: "心理咨询",
  },
  {
    key: "/student/history",
    icon: <HistoryOutlined />,
    label: "历史会话",
  },
];

const adminItems: MenuProps["items"] = [
  {
    key: "/admin",
    icon: <DashboardOutlined />,
    label: "数据概览",
  },
  {
    key: "/admin/cases",
    icon: <SafetyOutlined />,
    label: "风险个案",
  },
  {
    key: "/admin/reports",
    icon: <FileTextOutlined />,
    label: "风险报告",
  },
  {
    key: "/admin/ledger",
    icon: <FileExcelOutlined />,
    label: "数据台账",
  },
  {
    key: "/admin/alerts",
    icon: <BellOutlined />,
    label: "预警记录",
  },
  {
    key: "/admin/knowledge",
    icon: <BookOutlined />,
    label: "知识库管理",
  },
  {
    key: "/admin/docs",
    icon: <FolderOpenOutlined />,
    label: "文档管理",
  },
  {
    key: "/admin/users",
    icon: <UserOutlined />,
    label: "用户管理",
  },
  {
    key: "/admin/runtime",
    icon: <SwapOutlined />,
    label: "运行切换",
  },
  {
    key: "/admin/logs",
    icon: <FileTextOutlined />,
    label: "日志查询",
  },
  {
    key: "/admin/analysis",
    icon: <DashboardOutlined />,
    label: "数据分析",
  },
];

export function SidebarPlaceholder({ workspace }: SidebarPlaceholderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const collapsed = useUiStore((state) => state.sidebarCollapsed);
  const items = workspace === "admin" ? adminItems : studentItems;
  const selectedKey =
    items
      ?.map((item) =>
        item && "key" in item && typeof item.key === "string" ? item.key : "",
      )
      .filter(Boolean)
      .sort((a, b) => b.length - a.length)
      .find((key) => pathname === key || pathname.startsWith(`${key}/`)) ??
    pathname;

  return (
    <aside
      className="hidden shrink-0 overflow-hidden border-r border-slate-200 bg-white transition-[width] duration-200 md:block"
      style={{ width: collapsed ? 80 : 180 }}
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
              {workspace === "admin" ? "管理后台" : "学生端"}
            </Typography.Text>
          </div>
        ) : null}
      </div>
      <div className="p-2">
        <Menu
          mode="inline"
          inlineCollapsed={collapsed}
          selectedKeys={[selectedKey]}
          items={items}
          onClick={({ key }) => router.push(String(key))}
          className="mindbridge-sidebar-menu !border-0"
        />
      </div>
    </aside>
  );
}
