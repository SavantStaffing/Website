import { createFileRoute } from "@tanstack/react-router";
import { Chat } from "@/components/site/Chat";
import { chatSearch } from "@/lib/chat";

export const Route = createFileRoute("/recruiter/chat")({
  validateSearch: chatSearch,
  head: () => ({
    meta: [{ title: "Chat" }, { name: "robots", content: "noindex" }],
  }),
  component: ChatPage,
});

function ChatPage() {
  const { userId } = Route.useRouteContext();
  const { c, to } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <Chat
      userId={userId}
      hub="recruiter"
      conversationId={c}
      startWith={to}
      onOpen={(id) => navigate({ search: id ? { c: id } : {} })}
    />
  );
}
