import { NextResponse } from "next/server";
import { requireAccountAccess } from "@/lib/accounts";
import { createClient } from "@/lib/supabase/server";
import type {
  BankReportingTreatment,
  BankTransactionKind,
  EntryType,
  KnownBankRule
} from "@/lib/types";

type KnownRuleRow = {
  id: string;
  account_id: string;
  created_by: string;
  label: string;
  normalized_includes: string[] | null;
  payment_type: string | null;
  entry_type: EntryType | null;
  transaction_kind: BankTransactionKind;
  cat: string;
  workspace_id: string | null;
  confidence_score: number;
  reporting_treatment: BankReportingTreatment;
  auto_apply: boolean;
  created_at: string;
};

function toRule(row: KnownRuleRow): KnownBankRule {
  return {
    id: row.id,
    accountId: row.account_id,
    createdBy: row.created_by,
    label: row.label,
    normalizedIncludes: row.normalized_includes ?? [],
    paymentType: row.payment_type,
    entryType: row.entry_type,
    transactionKind: row.transaction_kind,
    cat: row.cat,
    workspaceId: row.workspace_id,
    confidenceScore: row.confidence_score,
    reportingTreatment: row.reporting_treatment,
    autoApply: row.auto_apply,
    createdAt: row.created_at
  };
}

function normalizePayload(input: {
  label?: string;
  normalizedIncludes?: string[];
  paymentType?: string | null;
  entryType?: EntryType | null;
  transactionKind?: BankTransactionKind;
  cat?: string;
  workspaceId?: string | null;
  confidenceScore?: number;
  reportingTreatment?: BankReportingTreatment;
  autoApply?: boolean;
}) {
  const includes = (input.normalizedIncludes ?? [])
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);

  return {
    label: input.label?.trim(),
    normalized_includes: includes,
    payment_type: input.paymentType?.trim() || null,
    entry_type: input.entryType ?? null,
    transaction_kind: input.transactionKind ?? "other",
    cat: input.cat?.trim() || "Annet",
    workspace_id: input.workspaceId || null,
    confidence_score:
      typeof input.confidenceScore === "number" && Number.isFinite(input.confidenceScore)
        ? Math.max(0, Math.min(100, Math.round(input.confidenceScore)))
        : 99,
    reporting_treatment: input.reportingTreatment ?? "normal",
    auto_apply: input.autoApply ?? true
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId") ?? undefined;
    const account = await requireAccountAccess(accountId);
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("bank_known_rules")
      .select(
        "id, account_id, created_by, label, normalized_includes, payment_type, entry_type, transaction_kind, cat, workspace_id, confidence_score, reporting_treatment, auto_apply, created_at"
      )
      .eq("account_id", account.accountId)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({ rules: ((data ?? []) as KnownRuleRow[]).map(toRule) });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Could not load rules." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const {
      accountId,
      label,
      normalizedIncludes,
      paymentType,
      entryType,
      transactionKind,
      cat,
      workspaceId,
      confidenceScore,
      reportingTreatment,
      autoApply
    } = (await request.json()) as {
      accountId?: string;
      label?: string;
      normalizedIncludes?: string[];
      paymentType?: string | null;
      entryType?: EntryType | null;
      transactionKind?: BankTransactionKind;
      cat?: string;
      workspaceId?: string | null;
      confidenceScore?: number;
      reportingTreatment?: BankReportingTreatment;
      autoApply?: boolean;
    };

    const account = await requireAccountAccess(accountId);
    if (!label?.trim()) {
      return NextResponse.json({ message: "Missing label." }, { status: 400 });
    }

    const payload = normalizePayload({
      label,
      normalizedIncludes,
      paymentType,
      entryType,
      transactionKind,
      cat,
      workspaceId,
      confidenceScore,
      reportingTreatment,
      autoApply
    });

    if (!payload.label) {
      return NextResponse.json({ message: "Missing label." }, { status: 400 });
    }

    if (payload.normalized_includes.length === 0 && !payload.payment_type?.trim()) {
      return NextResponse.json({ message: "Add at least one text pattern or payment type." }, { status: 400 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("bank_known_rules")
      .insert({
        account_id: account.accountId,
        created_by: account.user.id,
        label: payload.label,
        normalized_includes: payload.normalized_includes,
        payment_type: payload.payment_type,
        entry_type: payload.entry_type,
        transaction_kind: payload.transaction_kind,
        cat: payload.cat,
        workspace_id: payload.workspace_id,
        confidence_score: payload.confidence_score,
        reporting_treatment: payload.reporting_treatment,
        auto_apply: payload.auto_apply
      })
      .select(
        "id, account_id, created_by, label, normalized_includes, payment_type, entry_type, transaction_kind, cat, workspace_id, confidence_score, reporting_treatment, auto_apply, created_at"
      )
      .single();

    if (error || !data) {
      throw error ?? new Error("Could not create rule.");
    }

    return NextResponse.json({ rule: toRule(data as KnownRuleRow) });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Could not create rule." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const {
      accountId,
      id,
      label,
      normalizedIncludes,
      paymentType,
      entryType,
      transactionKind,
      cat,
      workspaceId,
      confidenceScore,
      reportingTreatment,
      autoApply
    } = (await request.json()) as {
      accountId?: string;
      id?: string;
      label?: string;
      normalizedIncludes?: string[];
      paymentType?: string | null;
      entryType?: EntryType | null;
      transactionKind?: BankTransactionKind;
      cat?: string;
      workspaceId?: string | null;
      confidenceScore?: number;
      reportingTreatment?: BankReportingTreatment;
      autoApply?: boolean;
    };

    const account = await requireAccountAccess(accountId);
    if (!id) {
      return NextResponse.json({ message: "Missing rule id." }, { status: 400 });
    }

    const payload = normalizePayload({
      label,
      normalizedIncludes,
      paymentType,
      entryType,
      transactionKind,
      cat,
      workspaceId,
      confidenceScore,
      reportingTreatment,
      autoApply
    });

    if (!payload.label) {
      return NextResponse.json({ message: "Missing label." }, { status: 400 });
    }

    if (payload.normalized_includes.length === 0 && !payload.payment_type?.trim()) {
      return NextResponse.json({ message: "Add at least one text pattern or payment type." }, { status: 400 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("bank_known_rules")
      .update({
        label: payload.label,
        normalized_includes: payload.normalized_includes,
        payment_type: payload.payment_type,
        entry_type: payload.entry_type,
        transaction_kind: payload.transaction_kind,
        cat: payload.cat,
        workspace_id: payload.workspace_id,
        confidence_score: payload.confidence_score,
        reporting_treatment: payload.reporting_treatment,
        auto_apply: payload.auto_apply
      })
      .eq("id", id)
      .eq("account_id", account.accountId)
      .select(
        "id, account_id, created_by, label, normalized_includes, payment_type, entry_type, transaction_kind, cat, workspace_id, confidence_score, reporting_treatment, auto_apply, created_at"
      )
      .single();

    if (error || !data) {
      throw error ?? new Error("Could not update rule.");
    }

    return NextResponse.json({ rule: toRule(data as KnownRuleRow) });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Could not update rule." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { accountId, id } = (await request.json()) as { accountId?: string; id?: string };
    const account = await requireAccountAccess(accountId);

    if (!id) {
      return NextResponse.json({ message: "Missing rule id." }, { status: 400 });
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("bank_known_rules")
      .delete()
      .eq("id", id)
      .eq("account_id", account.accountId);

    if (error) {
      throw error;
    }

    return NextResponse.json({ message: "Rule deleted." });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Could not delete rule." },
      { status: 500 }
    );
  }
}
