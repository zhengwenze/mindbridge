import type { ThemeConfig } from "antd";

export const antdTheme: ThemeConfig = {
  token: {
    colorPrimary: "#12847f",
    colorInfo: "#2563eb",
    colorSuccess: "#16a34a",
    colorWarning: "#f59e0b",
    colorError: "#dc2626",
    colorBgLayout: "#f8fafc",
    colorBgContainer: "#ffffff",
    colorBorder: "#d9e2e7",
    colorText: "#0f172a",
    colorTextSecondary: "#64748b",
    borderRadius: 6,
    controlHeight: 36,
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif'
  },
  components: {
    Button: {
      borderRadius: 6,
      controlHeight: 36
    },
    Card: {
      borderRadiusLG: 8,
      paddingLG: 24
    },
    Layout: {
      bodyBg: "#f8fafc",
      headerBg: "#ffffff",
      siderBg: "#ffffff"
    },
    Menu: {
      itemBorderRadius: 6,
      itemHeight: 40
    },
    Result: {
      titleFontSize: 24
    }
  }
};
