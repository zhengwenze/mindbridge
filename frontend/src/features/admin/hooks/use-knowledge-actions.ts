"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  backupKnowledgeVector,
  fetchKnowledgeStatus,
  rebuildKnowledgeVector,
  uploadKnowledgeFile
} from "../api/admin-api";
import { adminQueryKeys } from "./use-admin-dashboard";

export function useKnowledgeStatus() {
  return useQuery({
    queryKey: adminQueryKeys.knowledgeStatus,
    queryFn: fetchKnowledgeStatus
  });
}

export function useKnowledgeActions() {
  const queryClient = useQueryClient();

  function refreshKnowledgeStatus() {
    return queryClient.invalidateQueries({ queryKey: adminQueryKeys.knowledgeStatus });
  }

  const uploadMutation = useMutation({
    mutationFn: uploadKnowledgeFile,
    onSuccess: refreshKnowledgeStatus
  });

  const rebuildMutation = useMutation({
    mutationFn: rebuildKnowledgeVector,
    onSuccess: refreshKnowledgeStatus
  });

  const backupMutation = useMutation({
    mutationFn: backupKnowledgeVector,
    onSuccess: refreshKnowledgeStatus
  });

  return {
    uploadMutation,
    rebuildMutation,
    backupMutation
  };
}
