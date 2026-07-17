"use client";

import { StudentChatPanel } from "./student-chat-panel";
import { useChatStream } from "../hooks/use-chat-stream";

export function StudentChat() {
  const chat = useChatStream();
  return (
    <main className="flex min-h-[calc(100vh-64px)] w-full p-4">
      <StudentChatPanel chat={chat} />
    </main>
  );
}
