# Kroner — Prosjektkontekst

## Hva er dette?

Kroner er en personlig økonomiapp bygget for Oscar. Den er laget for å håndtere økonomi på tvers av flere selskaper og privatøkonomi, med AI-assistert kategorisering via Claude API.

Appen er foreløpig én HTML-fil (`index.html`) med vanilla JS og localStorage. Neste steg er å bygge den om til Next.js + Supabase.

---

## Nåværende stack

- **Frontend:** Vanilla HTML/CSS/JS — én enkelt `index.html`
- **Lagring:** `localStorage` (nøkkel: `oko5_entries`, `oko5_ws`, `oko5_subs`)
- **AI:** Claude API direkte fra klienten (`claude-3-5-haiku-20241022`)
- **Deploy:** Vercel (statisk), GitHub repo

---

## Planlagt stack (Next.js)

- **Framework:** Next.js (App Router)
- **Database:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth
- **Hosting:** Vercel
- **AI:** Claude API via Next.js API route (ikke direkte fra klient)

---

## Kontoer / workspaces

Oscar har følgende kontoer som er hardkodet som defaults:

| ID | Navn | Farge |
|---|---|---|
| `privat` | Privat | `#787774` |
| `applaus` | Applaus Creative | `#0060b0` |
| `aett` | Aett Events | `#0f7b55` |
| `texicon` | Texicon | `#9f6b00` |

Brukeren kan legge til nye kontoer selv med valgfri farge.

---

## Datamodell (localStorage → skal bli Supabase)

### entries
```ts
{
  id: number           // Date.now()
  name: string
  amount: number
  type: 'income' | 'expense'
  cat: string          // kategori
  ws: string           // workspace/konto id
  date: string         // YYYY-MM-DD
  link: string         // lenke til faktura (Drive/mail)
  note: string
}
```

### subs (abonnementer + faste inntekter)
```ts
{
  id: number
  name: string
  amount: number
  type: 'sub' | 'fixed'   // sub = abonnement, fixed = fast inntekt
  cat: string
  ws: string
  link: string
}
```

### workspaces
```ts
{
  id: string    // slugified navn + timestamp
  name: string
  color: string // hex
}
```

---

## Kategorier

```
Fakturainntekter
Lønn & honorar
Stipend
Utbytte
Programvare & verktøy
Mat & drikke
Transport
Utstyr & hardware
Abonnementer
Annet
```

---

## Features som er bygget

- [x] Oversiktsside med summary-kort (faste inntekter, engangs, utgifter, abonnementer, netto)
- [x] Transaksjoner med filtrering per kategori
- [x] Faste inntekter (månedlig, vises separat)
- [x] Abonnementer (månedlig kostnad, vises separat)
- [x] Graf-side — søylediagram siste 6 måneder + doughnut per kategori (Chart.js)
- [x] AI-kategorisering — Claude gjetter type, kategori og konto når du skriver navn
- [x] Kamera/OCR — ta bilde av kvittering, Claude leser og fyller inn feltene
- [x] CSV-eksport med norske tegn (BOM)
- [x] Søk på tvers av navn, kategori og notat
- [x] Månedlig navigasjon (forrige/neste måned)
- [x] Kontoer som dropdown i header
- [x] Navigasjon (Sider) som dropdown i sidebar
- [x] PWA-manifest med egne ikoner (appicon.png + splashicon.png)
- [x] Mobilvennlig layout (sidebar blir horisontal på mobil)
- [x] Lenke til faktura per post

---

## Features som mangler / neste steg

- [ ] Migrere fra localStorage til Supabase
- [ ] Auth (Supabase Auth — bare Oscar skal ha tilgang)
- [ ] API-route for Claude-kall (ikke direkte fra klient)
- [ ] CSV-import fra Nordea kontoutskrift
- [ ] Budsjett per konto/måned
- [ ] Fakturastatus (sendt / betalt / forfalt)
- [ ] Push-varsling ved forfall

---

## AI-integrasjon

### Kategorisering (tekst)
Kalles når brukeren skriver inn navn i "Legg til"-modalen. Debounced 600ms.

```
Model: claude-3-5-haiku-20241022
System: Norsk økonomiassistent. Svar KUN med JSON.
        {"type":"expense","cat":"Programvare & verktøy","ws":"applaus"}
        Type: income/expense/sub/fixed
        Kategorier: [liste]
        Kontoer: [liste med id]
Input: Post: "{navn}"
```

Bruker godkjenner eller avviser forslaget med ✓/✗-knapper.

### OCR (bilde)
Kalles når bruker laster opp bilde av kvittering/faktura.

```
Model: claude-3-5-haiku-20241022
System: Samme som over, men returnerer også date og amount
Input: image (base64) + tekst
Output: {"name":"...","amount":0,"date":"YYYY-MM-DD","cat":"...","type":"...","ws":"..."}
```

I Next.js-versjonen skal begge disse gå via en `/api/categorize`-route som holder API-nøkkelen server-side.

---

## Design

- **Font:** Inter (UI) + JetBrains Mono (tall/kode)
- **Fargepalett:** Notion-inspirert — hvit bakgrunn, varme grånyanser
- **Accent-farger:**
  - Inntekt: `#0f7b55` (grønn)
  - Utgift: `#c9372c` (rød)
  - Abonnement: `#9f6b00` (amber)
  - Fast inntekt: `#1d4ed8` (blå)
- **App-farger:** Mørkeblå bakgrunn (`#0000cd`) med lys blå tekst — fra ikonene
- **Ikoner:** `appicon.png` (192x192, app-ikon) og `splashicon.png` (512x512, splash)

---

## Kontekst om Oscar

- Driver **Applaus Creative** (designstudio, ENK → AS under opprettelse)
- Involvert i **Aett Events** (AS under opprettelse), **Texicon** (eierandel), **Radio Revolt**
- Masterstudent ved NTNU, Trondheim
- Appen brukes foreløpig kun for ENK og privatøkonomi — AS-kontiene legges til når de er operative
- Regnskapssystem: vurderer Fiken for AS, bruker Tripletex for ENK i dag

---

## Filstruktur (nåværende)

```
kroner-app/
├── index.html     # hele appen
├── CONTEXT.md     # denne filen
└── README.md      # (valgfritt)
```

## Filstruktur (Next.js — planlagt)

```
kroner-app/
├── app/
│   ├── layout.tsx
│   ├── page.tsx           # oversikt
│   ├── transaksjoner/
│   ├── faste/
│   ├── abonnementer/
│   ├── graf/
│   └── api/
│       ├── categorize/    # Claude API-kall
│       └── ocr/           # bilde-analyse
├── components/
│   ├── Sidebar.tsx
│   ├── Header.tsx
│   ├── EntryRow.tsx
│   ├── SubCard.tsx
│   ├── AddModal.tsx
│   ├── CameraModal.tsx
│   └── Charts.tsx
├── lib/
│   ├── supabase.ts
│   └── types.ts
├── public/
│   ├── appicon.png
│   └── splashicon.png
├── CONTEXT.md
└── .env.local     # ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY
```
