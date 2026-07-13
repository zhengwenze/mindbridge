"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createKnowledgeBase,
  deleteKnowledgeBase,
  fetchKnowledgeBase,
  fetchKnowledgeBases,
  rebuildKnowledgeBase,
  updateKnowledgeBase,
  uploadKnowledgeDocument
} from "../api/admin-api";
import type { KnowledgeBaseFilters, KnowledgeBasePayload } from "../types/admin-types";

const knowledgeBaseKey = ["admin", "knowledge-bases"] as const;

export function useKnowledgeBases(filters: KnowledgeBaseFilters) {
  return useQuery({ queryKey: [...knowledgeBaseKey, filters], queryFn: () => fetchKnowledgeBases(filters) });
}

export function useKnowledgeBase(id: number | null) {
  return useQuery({ queryKey: [...knowledgeBaseKey, id], queryFn: () => fetchKnowledgeBase(id as number), enabled: id !== null });
}

export function useKnowledgeActions() {
  const client = useQueryClient();
  const refresh = () => client.invalidateQueries({ queryKey: knowledgeBaseKey });
  return {
    createMutation: useMutation({ mutationFn: createKnowledgeBase, onSuccess: refresh }),
    updateMutation: useMutation({ mutationFn: ({ id, payload }: { id: number; payload: KnowledgeBasePayload }) => updateKnowledgeBase(id, payload), onSuccess: refresh }),
    deleteMutation: useMutation({ mutationFn: deleteKnowledgeBase, onSuccess: refresh }),
    uploadMutation: useMutation({ mutationFn: ({ id, file }: { id: number; file: File }) => uploadKnowledgeDocument(id, file), onSuccess: refresh }),
    rebuildMutation: useMutation({ mutationFn: rebuildKnowledgeBase, onSuccess: refresh })
  };
}
