import { NextResponse } from "next/server";
import { requireAccountAccess } from "@/lib/accounts";
import { parseNordeaCsv } from "@/lib/bank-import";
import {
  buildReviewItemsFromParsed,
  fetchBankLearningExamples,
  fetchExistingEntryMatches,
  summarizeParsedRows
} from "@/lib/bank-import-server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const accountId = formData.get("accountId");
    const workspaceId = formData.get("workspaceId");
    const file = formData.get("file");

    if (typeof accountId !== "string") {
      return NextResponse.json({ message: "Missing accountId." }, { status: 400 });
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ message: "Missing CSV file." }, { status: 400 });
    }

    if (typeof workspaceId !== "string" || workspaceId.length === 0) {
      return NextResponse.json({ message: "Velg workspace for denne CSV-importen." }, { status: 400 });
    }

    const account = await requireAccountAccess(accountId);
    const csvText = await file.text();
    const parsedRows = parseNordeaCsv(csvText);

    if (parsedRows.length === 0) {
      return NextResponse.json({ message: "CSV-filen var tom." }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: workspace, error: workspaceError } = await supabase
      .from("workspaces")
      .select("id, name")
      .eq("account_id", account.accountId)
      .eq("id", workspaceId)
      .maybeSingle();

    if (workspaceError) {
      throw new Error(workspaceError.message);
    }

    if (!workspace) {
      return NextResponse.json({ message: "Ugyldig workspace for valgt konto." }, { status: 400 });
    }

    const { data: batch, error: batchError } = await supabase
      .from("bank_import_batches")
      .insert({
        account_id: account.accountId,
        created_by: account.user.id,
        provider: "nordea_csv",
        source_name: "Nordea",
        file_name: file.name,
        default_workspace_id: workspace.id,
        status: "parsed"
      })
      .select("id, default_workspace_id")
      .single();

    if (batchError || !batch) {
      throw new Error(batchError?.message || "Could not create import batch.");
    }

    const [entries, learningExamples] = await Promise.all([
      fetchExistingEntryMatches(account.accountId),
      fetchBankLearningExamples(account.accountId)
    ]);
    const importContext = {
      defaultWorkspaceId: workspace.id,
      defaultWorkspaceName: workspace.name
    };
    const reviewItems = buildReviewItemsFromParsed(
      batch.id,
      parsedRows,
      entries,
      learningExamples,
      importContext
    );
    const rowMap = new Map(parsedRows.map((row) => [row.lineNumber, row]));
    const transactionRows = reviewItems.map((item) => {
      const lineNumber = Number(item.id.split(":")[1]);
      const parsed = rowMap.get(lineNumber);

      return {
        batch_id: batch.id,
        account_id: account.accountId,
        created_by: account.user.id,
        line_number: lineNumber,
        booking_date: parsed?.bookingDate ?? null,
        raw_booking_date: parsed?.rawBookingDate ?? "",
        amount: item.amount,
        currency: item.currency,
        payment_type: item.paymentType,
        sender: parsed?.sender ?? null,
        receiver: parsed?.receiver ?? null,
        title: parsed?.title ?? null,
        name: parsed?.name ?? null,
        raw_label: item.rawLabel,
        normalized_label: item.normalizedLabel,
        entry_type: item.entryType,
        source_fingerprint: parsed?.sourceFingerprint ?? "",
        review_group: item.reviewGroup,
        suggested_action: item.suggestedAction,
        suggested_entry_id: item.suggestedMatch?.entryId ?? null,
        suggested_match_score: item.suggestedMatch?.score ?? 0,
        raw_data: {
          ...parsed?.rawData,
          isOwnTransfer: item.isOwnTransfer,
          isReserved: item.isReserved
        }
      };
    });

    const { error: insertError } = await supabase.from("bank_transactions").insert(transactionRows);

    if (insertError) {
      throw new Error(insertError.message);
    }

    return NextResponse.json({
      batchId: batch.id,
      importContext,
      summary: summarizeParsedRows(reviewItems)
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Could not parse bank CSV."
      },
      { status: 500 }
    );
  }
}
