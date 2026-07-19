import { NextResponse } from "next/server";

import { loadApplicationEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

// Railway deployment readiness: validate required application configuration
// without opening a database connection or revealing values. A 200 means the
// process can serve requests with a valid environment shape; hosted Supabase
// reachability remains a separate operational verification.
export function GET(): NextResponse {
  try {
    loadApplicationEnv();
    return NextResponse.json(
      { status: "ready" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { status: "misconfigured" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
