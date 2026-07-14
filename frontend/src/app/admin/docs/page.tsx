import { PageContainer } from "@/components/layout/page-container";
import { DocumentManagementWorkspace } from "@/features/admin/components/document-management-workspace";

export default function AdminDocumentsRoute() {
  return (
    <PageContainer
      title="文档管理"
      description="上传、筛选和维护知识库文档，预览字符拆分结果并按文档重新索引。"
    >
      <DocumentManagementWorkspace />
    </PageContainer>
  );
}
