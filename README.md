# Modern Gurukul — Fresh Starter

Modern Gurukul frontend starter built with React + Vite and Supabase. Includes student authentication, course/lesson UI, dashboard, and an admin page scaffold. Configure Supabase before using real student data or uploading private lectures.

## Run locally
1. Install Node.js LTS.
2. Open this folder in VS Code.
3. Run `npm install`
4. Copy `.env.example` to `.env`
5. Fill in the Supabase project URL and publishable/anon key.
6. Run `npm run dev` and open the shown local URL.

## Supabase setup
1. In Supabase SQL Editor, run `supabase/schema.sql`.
2. Configure Auth settings as needed.
3. Set the admin role only for your own account using the secure steps below; do not let users choose their own role.
4. Review RLS policies and Storage access before adding real data or private video files.

## Environment variables
Use the exact names expected by `src/supabase.js`. Never put a Supabase `service_role` or secret key in a frontend `.env` file.

## Important security note
This is a starter, not a production security audit. Before public launch, verify RLS policies, admin role assignment, and private video storage/access rules. Keep all lectures private until that work is complete.
