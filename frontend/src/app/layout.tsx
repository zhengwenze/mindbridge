import type { Metadata } from "next";
import { AntdRegistry } from "@ant-design/nextjs-registry";

import { AppProviders } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "MindBridge Frontend",
  description: "MindBridge frontend workspace"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>
        <AntdRegistry>
          <AppProviders>{children}</AppProviders>
        </AntdRegistry>
      </body>
    </html>
  );
}
