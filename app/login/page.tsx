import { LoginClient } from "@/components/LoginClient";

export default async function LoginPage({
  searchParams
}: {
  searchParams?: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;
  const initialError =
    params?.error === "unauthorized" ? "Denne brukeren har ikke tilgang til appen." : "";

  return <LoginClient initialError={initialError} nextPath={params?.next || "/"} />;
}
