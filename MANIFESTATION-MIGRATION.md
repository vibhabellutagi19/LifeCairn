# Manifestation extraction

The standalone repository is `../manifestation` and runs at http://localhost:6002 (`npm run dev` there). Set `MANIFESTATION_APP_URL` in LifeCairn for a different address.

The new local PostgreSQL database is `manifestation`, on the same server as `roadmap`. It now uses a single local profile with no authentication; migrated records in the new database are assigned to that profile. No LifeCairn database connection is needed by the new app.

Copied and compared every field in 99 affirmations, 8 affirmation check-ins, 21 emotional check-ins, and 10 custom emotions. Manifestation history, tracking settings and Hoʻoponopono tables were empty. Copied gratitude from 4 journal records, without journal content or mood. IDs, ownership, timestamps and sequence positions were preserved.

Journal now lives in Manifestation too. All 4 journal entries, including content and mood, were migrated and verified; gratitude from both databases was merged by distinct lines. LifeCairn journal routes redirect to Manifestation and stale forms cannot update the recovery copy. Journal is removed from LifeCairn navigation, module settings, dashboard and review queries. Original source tables remain for recovery. Manifestation is no longer a switchable LifeCairn module; old routes and stale server actions redirect to the standalone app. Dashboard and Review no longer query its legacy practice data.

Validation: standalone production build, TypeScript and ESLint passed; LifeCairn TypeScript and targeted ESLint passed. The standalone app no longer requires a Clerk account or credentials.

The new repository is initialized locally with no remote or commit. Existing unrelated LifeCairn working-tree changes were retained.
