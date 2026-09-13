import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "competence-web",
    timestamp: new Date().toISOString(),
  });
}
