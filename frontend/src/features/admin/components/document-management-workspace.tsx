"use client";

import { Tabs } from "antd";

import { DocumentListPanel } from "./document-list-panel";
import { DocumentUploadPanel } from "./document-upload-panel";

export function DocumentManagementWorkspace() {
  return (
    <Tabs
      defaultActiveKey="upload"
      destroyOnHidden={false}
      items={[
        {
          key: "upload",
          label: "上传文档",
          children: <DocumentUploadPanel />,
        },
        {
          key: "manage",
          label: "文档管理",
          children: <DocumentListPanel />,
        },
      ]}
    />
  );
}
