# Market Memory

Market Memory is an evidence-led research workspace for NVDA, AMD, and MSFT. It brings together daily market data, web sources, and previous research to help users revisit a company's changing story.

## Features

- Collect company and industry sources with Tavily and retain source links and retrieval dates.
- Use NVIDIA Nemotron through the Nebius Token Factory inference API to classify sources and generate a structured, cited research brief.
- Explore daily price, trading volume, and observed source sentiment in interactive charts.
- Save analyses and compare new evidence with a previous investigation.
- Calculate daily returns and Pearson correlations for predefined session lags in application code. Correlation is shown only when at least 30 valid pairs with nonzero variance are available.
- Report provider errors and data coverage without silently replacing real data with mock data.

Web results are a sample of retrieved sources, not a measure of total internet conversation. Correlations are exploratory associations, not predictions or evidence of causation. The application does not place trades.

## Requirements

- Node.js 24 and npm.
- API credentials for Nebius Token Factory, Tavily, and Alpha Vantage.
- Permission to display Alpha Vantage data to the intended audience.

## Run locally

1. Install dependencies:

   ```bash
   npm ci
   ```

2. Create a `.env.local` file at the project root. Supply your own values for the empty entries:

   ```dotenv
   NEBIUS_API_KEY=
   TAVILY_API_KEY=
   ALPHA_VANTAGE_API_KEY=
   NEBIUS_MODEL=
   ALPHA_VANTAGE_DISPLAY_APPROVED=false
   NEBIUS_DAILY_LIMIT=60
   TAVILY_DAILY_LIMIT=60
   ALPHA_DAILY_LIMIT=20
   DEMO_EMAIL=
   DEMO_PASSWORD_HASH=
   DEMO_SESSION_SECRET=
   DEMO_EXPIRES_AT=2030-01-01T00:00:00Z
   STORE_MODE=local
   ```

   Leave `NEBIUS_MODEL` empty to select an available NVIDIA Nemotron model from the Token Factory catalog, or enter the exact ID of an available model. Set `ALPHA_VANTAGE_DISPLAY_APPROVED=true` only after confirming the applicable display rights. Set `DEMO_EMAIL` to the email identifier used to sign in and choose an appropriate future expiry date.

3. Generate a random login password, a compatible password hash, and a session secret. Run this locally and keep the output private:

   ```bash
   node -e "const c=require('node:crypto');const p=c.randomBytes(24).toString('base64url');const s=c.randomBytes(16).toString('hex');console.log('Login password: '+p);console.log('DEMO_PASSWORD_HASH=pbkdf2-sha256:210000:'+s+':'+c.pbkdf2Sync(p,s,210000,32,'sha256').toString('hex'));console.log('DEMO_SESSION_SECRET='+c.randomBytes(32).toString('hex'))"
   ```

   Copy the two configuration values into `.env.local`. Keep the generated login password somewhere secure; it is used with `DEMO_EMAIL` to sign in. The application stores a password hash, not the login password.

4. Start the application:

   ```bash
   npm run dev
   ```

   Open `http://localhost:3000`, sign in, select a ticker, and run an analysis. Local records are stored in the ignored `.data` directory.

Never commit `.env.local`, API keys, login credentials, session secrets, or research data. Hosted use requires persistent storage and server-side configuration; local file storage is intended for a single local process.

## Verification

```bash
npm test
npm run typecheck
npm run build
```

The automated tests cover password verification and expiry, persistent storage behavior, quota reservations, and a research flow with mocked provider responses. A real deployment should also be tested with valid provider credentials and its configured persistent storage.

## License

MIT. See [LICENSE](LICENSE).
