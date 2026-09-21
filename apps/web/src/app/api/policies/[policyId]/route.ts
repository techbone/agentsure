import { PolicyNotFoundError, readPolicyFromArc } from "@/lib/policy-read-model";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ policyId: string }> },
): Promise<NextResponse> {
  const { policyId: rawPolicyId } = await context.params;
  if (!/^\d+$/.test(rawPolicyId) || BigInt(rawPolicyId) < 1n) {
    return NextResponse.json(
      { code: "INVALID_POLICY_ID", message: "Policy ID must be a positive integer." },
      { status: 400 },
    );
  }

  try {
    const policy = await readPolicyFromArc(BigInt(rawPolicyId));
    return NextResponse.json(policy, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof PolicyNotFoundError) {
      return NextResponse.json(
        { code: "POLICY_NOT_FOUND", message: `Policy #${rawPolicyId} does not exist.` },
        { status: 404 },
      );
    }
    return NextResponse.json(
      {
        code: "ARC_READ_UNAVAILABLE",
        message: "Arc policy data is temporarily unavailable. Onchain state remains authoritative.",
      },
      { status: 503 },
    );
  }
}
