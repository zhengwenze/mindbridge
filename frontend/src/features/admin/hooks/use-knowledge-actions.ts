"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  batchDeleteKnowledgeDocuments,
  createKnowledgeBase,
  deleteKnowledgeBase,
  deleteKnowledgeDocument,
  fetchKnowledgeBase,
  fetchKnowledgeBases,
  fetchKnowledgeDocuments,
  previewKnowledgeDocumentSplit,
  reindexKnowledgeDocument,
  rebuildKnowledgeBase,
  updateKnowledgeBase,
  uploadKnowledgeDocument
} from "../api/admin-api";
import type {
  DocumentSplitConfig,
  KnowledgeBaseFilters,
  KnowledgeBasePayload,
  KnowledgeDocumentFilters,
  KnowledgeDocumentUploadOptions,
} from "../types/admin-types";

export const knowledgeQueryKeys = {
  bases: ["admin", "knowledge-bases"] as const,
  baseLists: ["admin", "knowledge-bases", "list"] as const,
  baseList: (filters: KnowledgeBaseFilters) => ["admin", "knowledge-bases", "list", filters] as const,
  baseDetail: (id: number | null) => ["admin", "knowledge-bases", "detail", id] as const,
  documents: (knowledgeBaseId: number) => ["admin", "knowledge-bases", knowledgeBaseId, "documents"] as const,
  documentList: (knowledgeBaseId: number, filters: KnowledgeDocumentFilters) =>
    ["admin", "knowledge-bases", knowledgeBaseId, "documents", "list", filters] as const,
};

export function useKnowledgeBases(filters: KnowledgeBaseFilters) {
  return useQuery({ queryKey: knowledgeQueryKeys.baseList(filters), queryFn: () => fetchKnowledgeBases(filters) });
}

export function useKnowledgeBase(id: number | null) {
  return useQuery({ queryKey: knowledgeQueryKeys.baseDetail(id), queryFn: () => fetchKnowledgeBase(id as number), enabled: id !== null });
}

export function useKnowledgeDocuments(
  knowledgeBaseId: number | null,
  filters: KnowledgeDocumentFilters,
) {
  return useQuery({
    queryKey: knowledgeQueryKeys.documentList(knowledgeBaseId ?? 0, filters),
    queryFn: () => fetchKnowledgeDocuments(knowledgeBaseId as number, filters),
    enabled: knowledgeBaseId !== null,
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[2] === knowledgeBaseId ? previous : undefined,
  });
}

export function useKnowledgeActions() {
  const client = useQueryClient();
  const refresh = () => client.invalidateQueries({ queryKey: knowledgeQueryKeys.bases });
  return {
    createMutation: useMutation({ mutationFn: createKnowledgeBase, onSuccess: refresh }),
    updateMutation: useMutation({ mutationFn: ({ id, payload }: { id: number; payload: KnowledgeBasePayload }) => updateKnowledgeBase(id, payload), onSuccess: refresh }),
    deleteMutation: useMutation({ mutationFn: deleteKnowledgeBase, onSuccess: refresh }),
    uploadMutation: useMutation({
      mutationFn: ({ id, file, relativePath, onProgress, splitOptions }: {
        id: number;
        file: File;
        relativePath?: string;
        onProgress?: (percent: number) => void;
        splitOptions?: KnowledgeDocumentUploadOptions;
      }) => uploadKnowledgeDocument(id, file, relativePath, onProgress, splitOptions),
      onSuccess: (_result, variables) => {
        void refresh();
        void client.invalidateQueries({ queryKey: knowledgeQueryKeys.documents(variables.id) });
      },
    }),
    rebuildMutation: useMutation({ mutationFn: rebuildKnowledgeBase, onSuccess: refresh })
  };
}

export function useKnowledgeDocumentActions(knowledgeBaseId: number) {
  const client = useQueryClient();
  const refresh = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: knowledgeQueryKeys.documents(knowledgeBaseId) }),
      client.invalidateQueries({ queryKey: knowledgeQueryKeys.bases }),
      client.invalidateQueries({ queryKey: knowledgeQueryKeys.baseDetail(knowledgeBaseId) }),
    ]);
  };
  return {
    previewMutation: useMutation({
      mutationFn: ({ documentId, payload }: { documentId: number; payload: DocumentSplitConfig }) =>
        previewKnowledgeDocumentSplit(knowledgeBaseId, documentId, payload),
    }),
    reindexMutation: useMutation({
      mutationFn: ({ documentId, payload }: { documentId: number; payload: DocumentSplitConfig }) =>
        reindexKnowledgeDocument(knowledgeBaseId, documentId, payload),
      onSuccess: refresh,
    }),
    deleteMutation: useMutation({
      mutationFn: (documentId: number) => deleteKnowledgeDocument(knowledgeBaseId, documentId),
      onSuccess: refresh,
    }),
    batchDeleteMutation: useMutation({
      mutationFn: (documentIds: number[]) => batchDeleteKnowledgeDocuments(knowledgeBaseId, documentIds),
      onSuccess: refresh,
    }),
  };
}
