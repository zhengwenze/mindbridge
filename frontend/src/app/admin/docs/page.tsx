import { PageContainer } from "@/components/layout/page-container";
import { DocumentUploadPanel } from "@/features/admin/components/document-upload-panel";

export default function AdminDocumentsRoute() {
  return (
    <PageContainer
      title="文档管理"
      description="选择知识库后批量上传文档，支持拖拽、文件夹和逐文件进度。"
    >
      <DocumentUploadPanel />
    </PageContainer>
  );
}
