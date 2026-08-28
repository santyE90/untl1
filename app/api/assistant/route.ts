import { handleAssistantRequest } from "@/features/assistant/server/handler";
import { handleAssistantCancellation, handleAssistantConfirmation } from "@/features/assistant/server/confirmation-handler";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const action = request.headers.get("X-LifeStack-Assistant-Action");
  if (action === "confirm") return handleAssistantConfirmation(request);
  if (action === "cancel") return handleAssistantCancellation(request);
  return handleAssistantRequest(request);
}
