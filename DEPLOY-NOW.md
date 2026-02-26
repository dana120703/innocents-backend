# Fiks 404 – Backend må kjøre på Railway (ca. 15 min)

## Problemet
Railway bygger sannsynligvis **hele repo** (Next.js). Da blir det ingen FastAPI-backend, og `/ticket-types` gir 404.

## Løsning: To tjenester

### Steg 1 – Backend på Railway (den nåværende URL-en)

1. Gå til **Railway** → ditt prosjekt.
2. Klikk på **tjenesten** (den som har domenet).
3. **Settings** → **Source** (eller **Build**).
4. Finn **Root Directory** / **Monorepo**.
5. Sett **Root Directory** til: `backend` (uten skråstrek).
6. Sørg for at **Dockerfile** brukes (Railway finner `backend/Dockerfile` automatisk).
7. **Deploy** (eller vent på ny deploy).
8. Test: åpne **https://innocents-backend-production.up.railway.app/health** → skal vise `{"ok": true}`.
9. Test: **https://innocents-backend-production.up.railway.app/ticket-types** → skal vise JSON med billettyper.

Hvis du ikke ser "Root Directory", se under **Settings** → **Build** eller **Source** for "Root Directory" / "Service Source".

---

### Steg 2 – Frontend med riktig API-URL

Frontend må **bygges** med backend-URL, så den kaller riktig server.

**Variant A – Ny Railway-tjeneste (frontend)**

1. I samme Railway-prosjekt: **New** → **GitHub Repo** → velg **samme repo**.
2. La **Root Directory** stå tom (hele repo = Next.js).
3. Under **Variables** legg til:
   - `NEXT_PUBLIC_API_URL` = `https://innocents-backend-production.up.railway.app`
4. **Generate Domain** for denne tjenesten (f.eks. `innocents-frontend.up.railway.app`).
5. Deploy. Bruk denne URL-en for billettsiden.

**Variant B – Vercel (rask)**

1. Gå til [vercel.com](https://vercel.com) → **Add New** → **Project**.
2. Importer **samme GitHub-repo**.
3. **Root Directory**: la stå som `.` (rot).
4. Under **Environment Variables** legg til:
   - Name: `NEXT_PUBLIC_API_URL`  
   - Value: `https://innocents-backend-production.up.railway.app`
5. **Deploy**. Bruk Vercel-URL-en for billettsiden.

---

### Steg 3 – CORS på backend

I **Railway** → **backend-tjenesten** → **Variables**, sørg for at du har:

- `CORS_ORIGINS` = `https://innocents.no,https://billetter.innocents.no,http://localhost:3000`

Produksjons-frontend: **https://billetter.innocents.no**. Backend har dette som default; du trenger bare å sette `FRONTEND_RETURN_URL` = `https://billetter.innocents.no` hvis du overstyrer.

---

## Sjekkliste

- [ ] Backend-tjeneste har **Root Directory** = `backend`.
- [ ] **/health** og **/ticket-types** svarer på backend-URL (ingen 404).
- [ ] Frontend er deployet med **NEXT_PUBLIC_API_URL** = backend-URL.
- [ ] **CORS_ORIGINS** på backend inkluderer frontend-URL.

Etter det skal checkout fungere fra frontend-URL-en.
