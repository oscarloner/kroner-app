# Kroner

Next.js + Supabase-migrasjon av den opprinnelige `økonomi.html`-appen.

## Oppsett

1. Kopier `.env.example` til `.env.local`.
2. Fyll inn Supabase- og Anthropic-nøkler. Valgfritt: sett `ANTHROPIC_MODEL` hvis dere vil overstyre standardmodellen.
3. Kjør SQL-en i [supabase/schema.sql](/Users/oscar/Documents/kroner-app/supabase/schema.sql).
4. Installer avhengigheter med `npm install`.
5. Start appen med `npm run dev`.

## Hva som er flyttet

- App Router-struktur for oversikt, transaksjoner, faste inntekter, abonnementer og graf.
- Delte kontoer via `accounts` + `account_members`.
- Supabase Auth-gate via `ALLOWED_EMAIL` eller `ALLOWED_EMAILS`.
- Server-side API-ruter for Claude Haiku-kategorisering og OCR.
- Import av gammel `localStorage`-data til Supabase.
- Row Level Security på profiler, kontoer, medlemskap, workspaces, transaksjoner og faste poster.
- Enkel medlemsflyt i appen: owner/admin kan legge til andre brukere på en konto via e-post.

## Sikkerhet

- All data er konto-skopet, ikke bruker-skopet.
- RLS-policies bruker medlemskap i `account_members` for å avgjøre tilgang.
- Nye brukere får automatisk profil, personlig konto og owner-medlemskap via trigger.
- Sett `ALLOWED_EMAILS` for å begrense hvilke brukere som kan logge inn.
- I Supabase bør du i tillegg slå på `Confirm email` og bruke invite-only signup hvis dere vil være strenge.

## Legacy

Den gamle énfil-appen ligger fortsatt i [økonomi.html](/Users/oscar/Documents/kroner-app/økonomi.html) som referanse under migrasjonen.
