import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

const EMAIL_OTP_TYPES = new Set<EmailOtpType>(["email", "signup", "invite", "magiclink", "recovery", "email_change"]);

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const requestedType = request.nextUrl.searchParams.get("type");
  const redirectTo = request.nextUrl.clone();
  redirectTo.search = "";

  const supabase = await createClient();
  let verificationSucceeded = false;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    verificationSucceeded = !error;
  } else if (tokenHash && requestedType && EMAIL_OTP_TYPES.has(requestedType as EmailOtpType)) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: requestedType as EmailOtpType,
    });
    verificationSucceeded = !error;
  }

  if (verificationSucceeded) {
    redirectTo.pathname = "/dashboard";
    return NextResponse.redirect(redirectTo);
  }

  redirectTo.pathname = "/login";
  redirectTo.searchParams.set("error", "confirmation");
  return NextResponse.redirect(redirectTo);
}
