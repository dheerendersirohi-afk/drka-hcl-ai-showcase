# Share Package

This project has been prepared for sharing as a clean source package.

Included:
- main disaster dashboard source
- DRKA(HCL) app source
- Supabase migrations and functions
- configuration files
- README and support docs
- `.env.example`

Excluded from the share archive:
- `.env`
- `node_modules`
- `dist`
- local dev logs

Before another person runs the project, they should:
1. copy `.env.example` to `.env`
2. add their own Supabase and Sarvam credentials
3. run `npm install`
4. run `npm run dev`
