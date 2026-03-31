import { LoginForm } from "@/app/login/LoginForm";

export default async function LoginPage({
  searchParams
}: {
  searchParams?: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;
  const initialError =
    params?.error === "unauthorized" ? "Denne brukeren har ikke tilgang til appen." : "";

  return <LoginForm initialError={initialError} nextPath={params?.next || "/"} />;
}
