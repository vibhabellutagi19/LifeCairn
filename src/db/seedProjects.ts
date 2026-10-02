import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "./index";
import { projectTasks, projects, releases, roadmaps } from "./schema";

async function main() {
  const existing = await db.select().from(projects).limit(1);
  if (existing.length > 0) {
    console.log("Projects already exist — skipping import. Delete rows manually if you want to re-import.");
    process.exit(0);
  }

  const career = await db.query.roadmaps.findFirst({ where: eq(roadmaps.title, "Career") });

  console.log("Importing projects from freelance_project_tracker.xlsx (Move + NimmaVasti)...");

  const [move] = await db
    .insert(projects)
    .values({
      name: "Move - the gym app",
      client: "Akshay Bharadhwaj",
      status: "Active",
      roadmapId: career?.id ?? null,
      startDate: "2026-07-20",
      sortOrder: 0,
    })
    .returning();

  const [nimmaVasti] = await db
    .insert(projects)
    .values({
      name: "NimmaVasti",
      client: "Vibhavari Bellutagi",
      status: "Active",
      roadmapId: career?.id ?? null,
      notes: "Homestay/PG booking platform — the homestay project from the career roadmap.",
      sortOrder: 1,
    })
    .returning();

  console.log("Importing releases for Move...");

  const releaseRows = await db
    .insert(releases)
    .values([
      {
        projectId: move.id,
        name: "v1.0",
        targetDate: "2026-09-20",
        status: "released",
        notes: "Move first version released",
        sortOrder: 0,
      },
      {
        projectId: move.id,
        name: "v1.1.0",
        targetDate: "2026-09-22",
        status: "released",
        notes: "UI fixes",
        releaseNoteUrl: "https://github.com/vbellutagi-lab/movethemovementclan/releases/tag/v1.1.0",
        sortOrder: 1,
      },
      {
        projectId: move.id,
        name: "v1.2.0",
        targetDate: "2026-09-24",
        status: "planned",
        sortOrder: 2,
      },
      {
        projectId: move.id,
        name: "v1.3.0",
        targetDate: "2026-10-01",
        status: "planned",
        sortOrder: 3,
      },
      {
        projectId: move.id,
        name: "v1.4.0",
        targetDate: "2026-10-08",
        status: "planned",
        notes: "Imported from the spreadsheet as-is — it had two v1.4.0 rows with different target dates (10/8 and 10/15). Worth reconciling.",
        sortOrder: 4,
      },
      {
        projectId: move.id,
        name: "v1.4.0 (dup?)",
        targetDate: "2026-10-15",
        status: "planned",
        sortOrder: 5,
      },
      {
        projectId: move.id,
        name: "v1.5.0 - Major release",
        status: "planned",
        sortOrder: 6,
      },
    ])
    .returning();

  const releaseId = (name: string) => releaseRows.find((r) => r.name === name)!.id;

  console.log("Importing tasks for Move...");

  await db.insert(projectTasks).values([
    { projectId: move.id, title: "Invoice Generation", priority: "high", status: "not_started", dueDate: "2026-10-01", sortOrder: 0 },
    { projectId: move.id, title: "Discounts for payments", priority: "high", status: "not_started", dueDate: "2026-10-08", sortOrder: 1 },
    { projectId: move.id, title: "Mobile first UI", priority: "medium", status: "not_started", sortOrder: 2 },
    { projectId: move.id, title: "Lambda functions deploy", priority: "medium", status: "not_started", sortOrder: 3 },
    { projectId: move.id, title: "Add financial functionalities", priority: "low", status: "blocked", notes: "Ask Varun and Sunny", sortOrder: 4 },
    { projectId: move.id, title: "Multiple roles for an owner to select", priority: "low", status: "not_started", sortOrder: 5 },
    { projectId: move.id, title: "Setup SES mail", priority: "high", status: "not_started", sortOrder: 6 },
    { projectId: move.id, title: "Go through verification email jugad for clients", priority: "low", status: "not_started", sortOrder: 7 },
    { projectId: move.id, releaseId: releaseId("v1.2.0"), title: "CRUD for clients/coach profile", priority: "medium", status: "not_started", dueDate: "2026-09-24", sortOrder: 8 },
    { projectId: move.id, title: "Health Assessment", priority: "medium", status: "not_started", sortOrder: 9 },
    { projectId: move.id, title: "CRUD for Session types", priority: "medium", status: "not_started", sortOrder: 10 },
    { projectId: move.id, title: "In-app Notification System", priority: "medium", status: "not_started", sortOrder: 11 },
    { projectId: move.id, title: "Coach Dashboard revamp", priority: "medium", status: "not_started", sortOrder: 12 },
    { projectId: move.id, title: "Analytics and Audit", priority: "high", status: "not_started", sortOrder: 13 },
    { projectId: move.id, title: "Frontend page revamp", priority: "high", status: "not_started", sortOrder: 14 },
    { projectId: move.id, releaseId: releaseId("v1.2.0"), title: "Manual credits adjustment (from backend + add a feature)", priority: "high", status: "not_started", dueDate: "2026-09-24", sortOrder: 15 },
    { projectId: move.id, releaseId: releaseId("v1.2.0"), title: "CI/CD automation for release deploy", priority: "high", status: "not_started", dueDate: "2026-09-24", sortOrder: 16 },
    { projectId: move.id, title: "Plan opening the platform for other gym owners to use", priority: "low", status: "not_started", sortOrder: 17 },
    { projectId: move.id, title: "QA automation", priority: "low", status: "not_started", sortOrder: 18 },
    { projectId: move.id, title: "Infrastructure fixes and revamp", priority: "low", status: "not_started", sortOrder: 19 },
    { projectId: move.id, releaseId: releaseId("v1.2.0"), title: "Session cancellation request from coach to owner", priority: "high", status: "in_progress", dueDate: "2026-09-24", sortOrder: 20 },
    { projectId: move.id, title: "Security: DDOS etc.", priority: "low", status: "not_started", sortOrder: 21 },
  ]);

  console.log(`Imported: ${move.name} (7 releases, 22 tasks), ${nimmaVasti.name} (no releases/tasks yet).`);
  console.log("Import complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
