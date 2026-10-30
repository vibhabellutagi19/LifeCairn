import "dotenv/config";
import { db } from "./index";
import {
  financeAccounts,
  financeTargets,
  milestones,
  roadmaps,
} from "./schema";

function requireSeedUser(): string {
  const id = process.env.SEED_USER_ID;
  if (!id) {
    console.error("Set SEED_USER_ID to the Clerk user id (user_...) that should own the seeded data.");
    process.exit(1);
  }
  return id;
}

const userId = requireSeedUser();

function withUser<const T extends object>(rows: readonly T[]) {
  return rows.map((row) => ({ userId, ...row }));
}

async function main() {
  const existing = await db.select().from(roadmaps).limit(1);
  if (existing.length > 0) {
    console.log("Roadmaps already exist — skipping seed. Delete rows manually if you want to reseed.");
    process.exit(0);
  }

  console.log("Seeding roadmaps...");

  const [career] = await db
    .insert(roadmaps)
    .values({
      userId,
      title: "Career",
      category: "Career",
      color: "orange",
      description: "Polish the gym + homestay platforms, land warm-lead clients, explore the job market, and decide between business and job by Dec 31.",
      startDate: "2026-09-24",
      endDate: "2026-12-31",
      sortOrder: 0,
    })
    .returning();

  const [money] = await db
    .insert(roadmaps)
    .values({
      userId,
      title: "Money",
      category: "Money",
      color: "yellow",
      description: "Secure the base (FDs, mutual funds, incoming France transfer), activate business income, and build toward 60k-80k INR/month passive + active income by June 2027.",
      startDate: "2026-10-01",
      endDate: "2027-06-30",
      sortOrder: 1,
    })
    .returning();

  const [health] = await db
    .insert(roadmaps)
    .values({
      userId,
      title: "Health",
      category: "Health",
      color: "green",
      description: "Build consistent movement, nourishment, and strength. Release ~10kg safely by Dec 31 while preparing the body for conception.",
      startDate: "2026-09-23",
      endDate: "2026-12-31",
      sortOrder: 2,
    })
    .returning();

  const [relationship] = await db
    .insert(roadmaps)
    .values({
      userId,
      title: "Relationship",
      category: "Relationship",
      color: "pink",
      description: "Protect and deepen daily rituals, prepare for the India transition as a team, and move the relationship from a 5 to a 7-8 by Dec 31.",
      startDate: "2026-10-01",
      endDate: "2026-12-31",
      sortOrder: 3,
    })
    .returning();

  console.log("Seeding milestones...");

  await db.insert(milestones).values(withUser([
    // Career
    {
      roadmapId: career.id,
      title: "Polish gym platform + list 5-10 PG/homestay warm leads",
      notes: "Gym platform ready to scale in 7 days. Homestay warm leads identified. Student lead intro call locked in.",
      targetDate: "2026-10-01",
      sortOrder: 0,
    },
    {
      roadmapId: career.id,
      title: "Close warm leads for both platforms",
      notes: "3-4 discovery calls with PG/homestay owners. First intro call with student lead.",
      targetDate: "2026-10-15",
      sortOrder: 1,
    },
    {
      roadmapId: career.id,
      title: "Send proposals + close first deals",
      notes: "At least 1 homestay client signed + onboarded. Clarity on student lead project scope.",
      targetDate: "2026-10-31",
      sortOrder: 2,
    },
    {
      roadmapId: career.id,
      title: "Deploy second client on each platform",
      notes: "2 revenue streams active: at least 1 gym + 1 homestay generating money. Collect gym testimonial.",
      targetDate: "2026-11-14",
      sortOrder: 3,
    },
    {
      roadmapId: career.id,
      title: "Explore job market (light research)",
      notes: "Research 3-4 target companies. Update LinkedIn. Shortlist 2-3 recruiters.",
      targetDate: "2026-11-30",
      sortOrder: 4,
    },
    {
      roadmapId: career.id,
      title: "Finalize client revenue streams",
      notes: "Both platforms generating recurring revenue, documented monthly. Target: 3 revenue streams.",
      targetDate: "2026-12-14",
      sortOrder: 5,
    },
    {
      roadmapId: career.id,
      title: "Job interview process (if pursuing)",
      notes: "Reach out to 2-3 companies, take interviews, get written offers if it's the right path.",
      targetDate: "2026-12-23",
      sortOrder: 6,
    },
    {
      roadmapId: career.id,
      title: "DECISION DAY: freelance, job, or both",
      notes: "Decide from lived experience. Revenue flowing. Moving to India ready.",
      targetDate: "2026-12-31",
      sortOrder: 7,
    },

    // Money
    {
      roadmapId: money.id,
      title: "Money audit + PMDSPM setup",
      notes: "Open India Independence Fund account. Allocate the 15L France transfer: 30% safe income / 40% growth / 30% liquid buffer. 10% of every inflow goes straight to savings.",
      targetDate: "2026-10-31",
      sortOrder: 0,
    },
    {
      roadmapId: money.id,
      title: "Activate first business income",
      notes: "Target 10,000-20,000 INR MRR from gym software or homestay platform. Reinvest 50%, keep 50%.",
      targetDate: "2026-11-30",
      sortOrder: 1,
    },
    {
      roadmapId: money.id,
      title: "Stabilize and decide",
      notes: "2-3 paying clients. Business vs job path clarity. Lock India Independence Fund allocation.",
      targetDate: "2026-12-31",
      sortOrder: 2,
    },
    {
      roadmapId: money.id,
      title: "Set up monthly payouts",
      notes: "Activate SWP from debt mutual funds or FD monthly interest. Invoice first clients. Track every rupee.",
      targetDate: "2027-01-31",
      sortOrder: 3,
    },
    {
      roadmapId: money.id,
      title: "Optimize income mix toward 60k-80k/month",
      notes: "Balance investment income, platform revenue, and freelance/consulting. Don't upgrade lifestyle until 2L/month is consistent.",
      targetDate: "2027-06-30",
      sortOrder: 4,
    },
    {
      roadmapId: money.id,
      title: "Scale to 2 lakhs/month",
      notes: "More clients + higher prices with testimonials, or a 2-2.5L/month role using the platforms as proof of work.",
      targetDate: "2027-12-31",
      sortOrder: 5,
    },

    // Health
    {
      roadmapId: health.id,
      title: "Lock the basics",
      notes: "7-8hr sleep, 30min daily walk, 2.5-3L water, 3-day food awareness log, 2 yoga classes, nightly Ho'oponopono.",
      targetDate: "2026-09-30",
      sortOrder: 0,
    },
    {
      roadmapId: health.id,
      title: "Add structure",
      notes: "45min walk daily (8-10k steps), 2-3 yoga classes/week, repeatable protein-forward meal structure, weekly weigh-in.",
      targetDate: "2026-10-15",
      sortOrder: 1,
    },
    {
      roadmapId: health.id,
      title: "Strengthen + track — target 84-85kg",
      notes: "Add 2x/week bodyweight strength (20min). Continue walking + yoga. Support IUI with rest and low stress.",
      targetDate: "2026-10-31",
      sortOrder: 2,
    },
    {
      roadmapId: health.id,
      title: "Intensify gently — target 82-83kg",
      notes: "45-60min walk (10k steps), strength 3x/week, reduce sugar/refined flour. Release the pregnancy-timeline pressure.",
      targetDate: "2026-11-14",
      sortOrder: 3,
    },
    {
      roadmapId: health.id,
      title: "Lock the rhythm — target 80-81kg",
      notes: "Continue walk + strength + yoga. Gentle ovulation tracking if advised. Shift intimacy from task to connection.",
      targetDate: "2026-11-30",
      sortOrder: 4,
    },
    {
      roadmapId: health.id,
      title: "Push to target — 78-79kg",
      notes: "Daily walking, 3x strength, 2x yoga. Keep food clean and simple, no new diets.",
      targetDate: "2026-12-14",
      sortOrder: 5,
    },
    {
      roadmapId: health.id,
      title: "Stabilize + celebrate — 76-77kg",
      notes: "Maintain movement. Reflect on which habits to keep for life.",
      targetDate: "2026-12-31",
      sortOrder: 6,
    },

    // Relationship
    {
      roadmapId: relationship.id,
      title: "Deepen the foundation",
      notes: "Morning eye contact + cuddle, no phones in bed, 10-min bedtime cuddle, playful cooking, sacred balcony time.",
      targetDate: "2026-10-14",
      sortOrder: 0,
    },
    {
      roadmapId: relationship.id,
      title: "Weekly date night + \"us\" journal",
      notes: "One evening just for the two of you each week. Shower together once a week. Start writing one loved moment/week.",
      targetDate: "2026-10-31",
      sortOrder: 1,
    },
    {
      roadmapId: relationship.id,
      title: "Build resilience for the transition",
      notes: "Make the morning ritual portable, create a private signal, talk openly about the India move, schedule protected us-time.",
      targetDate: "2026-11-14",
      sortOrder: 2,
    },
    {
      roadmapId: relationship.id,
      title: "Practice boundaries + intimacy repair",
      notes: "Start setting small boundaries together. Keep removing ovulation-task pressure. Write a shared vision for marriage in India.",
      targetDate: "2026-11-30",
      sortOrder: 3,
    },
    {
      roadmapId: relationship.id,
      title: "Anchor daily appreciation",
      notes: "One specific appreciation daily, frequent small touch, phone-free meals.",
      targetDate: "2026-12-14",
      sortOrder: 4,
    },
    {
      roadmapId: relationship.id,
      title: "Reflect + non-negotiables list",
      notes: "What rituals worked? Write the relationship non-negotiables list to carry into India. Celebrate the growth.",
      targetDate: "2026-12-31",
      sortOrder: 5,
    },
  ]));

  console.log("Seeding finance accounts...");

  await db.insert(financeAccounts).values(withUser([
    { name: "Fixed Deposits", type: "fd", balance: "1660000" },
    { name: "Mutual Funds", type: "mutual_fund", balance: "2100000" },
    {
      name: "India Independence Fund",
      type: "bank",
      balance: "0",
      notes: "Destination for the ~15L France transfer. Split: 30% safe income / 40% growth / 30% liquid buffer.",
    },
  ]));

  console.log("Seeding finance targets...");

  await db.insert(financeTargets).values(withUser([
    { month: "2026-10", targetAmount: "10000" },
    { month: "2026-11", targetAmount: "20000" },
    { month: "2026-12", targetAmount: "20000" },
    { month: "2027-01", targetAmount: "70000" },
  ]));

  console.log("Seed complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
