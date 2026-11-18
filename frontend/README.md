# DedSec — web interface

React 19 + TypeScript + Vite. See the [main README](../README.md) for what DedSec is and how to run the whole stack.

## Running only the interface

```bash
cp .env.example .env    # fill in the Supabase URL, the anon key and the API URL
npm install
npm run dev             # http://localhost:5173
```

`npm run build` writes the production bundle to `dist/`.

The build needs `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Without them, the Supabase client throws on import and the bundler drops the whole application as unreachable code, producing a site that loads blank.

Only public values go in this `.env`: everything prefixed with `VITE_` is shipped to the browser. The `service_role` key belongs exclusively in the backend.
