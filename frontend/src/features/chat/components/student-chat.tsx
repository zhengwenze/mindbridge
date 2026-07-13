"use client";

import { StudentChatPanel } from "./student-chat-panel";
import { useChatStream } from "../hooks/use-chat-stream";

export function StudentChat() {
  const chat = useChatStream();
  return (
    <main className="mx-auto flex min-h-[calc(100vh-64px)] w-full max-w-6xl px-4 py-4 sm:px-6 lg:px-8">
      <StudentChatPanel chat={chat} />
    </main>
  );
}
