import { NextResponse } from "next/server";
import { requireAccountAccess } from "@/lib/accounts";
import { getBatchReview } from "@/lib/bank-import-server";

export async function GET(
  request: Request,
  context: { params: Promise<{ batchId: string }> }
) {
  try {
    const { batchId } = await context.params;
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId") ?? undefined;
    const account = await requireAccountAccess(accountId);
    const review = await getBatchReview(batchId, account.accountId);

    return NextResponse.json(review);
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Could not load batch review."
      },
      { status: 500 }
    );
  }
}
