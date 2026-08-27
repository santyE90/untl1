import { handleAssistantRequest } from "@/features/assistant/server/handler";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleAssistantRequest(request);
}
