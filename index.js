// smart-commits.mjs
import fs from "fs/promises";
import moment from "moment";
import simpleGit from "simple-git";
import crypto from "crypto";

const git = simpleGit();
const OUT_PATH = "./data.json"; // file we touch for each commit

// CONFIG
const START = moment("2024-02-08");
const END = moment("2025-05-09");
const TOTAL_COMMITS = 200;
const MAX_PER_DAY = 10; // allow occasional big spikes
const DRY_RUN = false;   // set true to only simulate

// Weighted choices for per-day commit counts (more zeros, fewer large spikes)
const weightedBuckets = [
  {count: 0, weight: 55},
  {count: 1, weight: 15},
  {count: 2, weight: 10},
  {count: 3, weight: 6},
  {count: 4, weight: 4},
  {count: 5, weight: 3},
  {count: 7, weight: 2},
  {count: 10, weight: 1},
  {count: 16, weight: 1},
];

function pickWeighted() {
  const totalWeight = weightedBuckets.reduce((s, b) => s + b.weight, 0);
  let r = crypto.randomInt(0, totalWeight);
  for (const b of weightedBuckets) {
    if (r < b.weight) return b.count;
    r -= b.weight;
  }
  return 0;
}

function randomInt(min, max) {
  return crypto.randomInt(min, max + 1);
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [array[i], array[j]] = [array[j], array[i]];
  }
}

// Generate list of dates (one per commit) matching TOTAL_COMMITS
function generateCommitDates() {
  const totalDays = END.diff(START, "days") + 1;
  // initial assignment
  const perDay = Array(totalDays).fill(0).map((_, idx) => {
    return { dayIndex: idx, date: moment(START).add(idx, "days"), commits: pickWeighted() };
  });

  let assigned = perDay.reduce((s, p) => s + p.commits, 0);

  // Adjust up or down to reach TOTAL_COMMITS
  if (assigned < TOTAL_COMMITS) {
    // add randomly
    while (assigned < TOTAL_COMMITS) {
      const idx = randomInt(0, totalDays - 1);
      if (perDay[idx].commits < MAX_PER_DAY) {
        perDay[idx].commits += 1;
        assigned += 1;
      }
    }
  } else if (assigned > TOTAL_COMMITS) {
    while (assigned > TOTAL_COMMITS) {
      const idx = randomInt(0, totalDays - 1);
      if (perDay[idx].commits > 0) {
        perDay[idx].commits -= 1;
        assigned -= 1;
      }
    }
  }

  // Expand into exact timestamps
  const commitTimestamps = [];
  for (const day of perDay) {
    for (let i = 0; i < day.commits; i++) {
      const h = randomInt(0, 23);
      const m = randomInt(0, 59);
      const s = randomInt(0, 59);
      const ts = moment(day.date).hour(h).minute(m).second(s);
      commitTimestamps.push(ts);
    }
  }

  // If rounding issues or zero, ensure length matches TOTAL_COMMITS (fall back)
  if (commitTimestamps.length !== TOTAL_COMMITS) {
    // If too few, add random timestamps across the range
    while (commitTimestamps.length < TOTAL_COMMITS) {
      const randDay = moment(START).add(randomInt(0, totalDays - 1), "days");
      const ts = moment(randDay).hour(randomInt(0,23)).minute(randomInt(0,59)).second(randomInt(0,59));
      commitTimestamps.push(ts);
    }
    // If too many, trim randomly
    while (commitTimestamps.length > TOTAL_COMMITS) {
      commitTimestamps.splice(randomInt(0, commitTimestamps.length - 1), 1);
    }
  }

  shuffle(commitTimestamps);
  return commitTimestamps;
}

// Create a pool of varied, realistic commit message templates and expand to count
function generateCommitMessages(count) {
  const verbs = [
    "fix", "feat", "chore", "refactor", "docs", "perf", "ci", "build", "test", "style", "ops"
  ];
  const scopes = [
    "auth", "ui", "api", "db", "config", "deps", "build", "map", "ride", "payments", "ux", "store"
  ];
  const shortNotes = [
    "typo", "improve load", "optimize queries", "add validation", "update docs",
    "bump dependency", "improve logging", "fix race", "improve error handling",
    "add tests", "adjust layout", "fix edge case", "improve retry", "cleanup"
  ];

  const msgs = [];
  for (let i = 0; i < count; i++) {
    const verb = verbs[randomInt(0, verbs.length - 1)];
    const scope = scopes[randomInt(0, scopes.length - 1)];
    const note = shortNotes[randomInt(0, shortNotes.length - 1)];
    // Add a small id so messages are unique and traceable
    msgs.push(`${verb}(${scope}): ${note} (#${i + 1})`);
  }
  return msgs;
}

// delay helper
const delay = (ms) => new Promise((res) => setTimeout(res, ms));

// Check and display git config to ensure it matches GitHub account
async function checkGitConfig() {
  try {
    const userName = await git.getConfig('user.name').catch(() => null);
    const userEmail = await git.getConfig('user.email').catch(() => null);
    
    const name = userName?.value || 'NOT SET';
    const email = userEmail?.value || 'NOT SET';
    
    console.log('='.repeat(60));
    console.log('Git Configuration Check:');
    console.log('='.repeat(60));
    console.log(`  user.name:  ${name}`);
    console.log(`  user.email: ${email}`);
    console.log('='.repeat(60));
    
    if (!userEmail?.value) {
      console.warn('\n⚠️  WARNING: user.email is not set!');
      console.warn('   Set it with: git config user.email "your-email@example.com"');
      console.warn('   Make sure this email matches your GitHub account email.\n');
    } else {
      console.log('\n✓ Git user.email is configured.');
      console.log('  Make sure this email matches your GitHub account email');
      console.log('  for contributions to show up correctly.\n');
    }
    
    return { name, email };
  } catch (err) {
    console.error('Error checking git config:', err.message);
    return { name: null, email: null };
  }
}

async function run() {
  try {
    // Check git config first
    const gitConfig = await checkGitConfig();
    
    const commitDates = generateCommitDates();
    const commitMessages = generateCommitMessages(commitDates.length);

    console.log(`Will create ${commitDates.length} commits from ${START.format("YYYY-MM-DD")} to ${END.format("YYYY-MM-DD")}`);
    console.log(`Dry run: ${DRY_RUN}`);
    if (DRY_RUN) {
      console.log('⚠️  DRY RUN MODE: No commits will be created. Set DRY_RUN = false to proceed.\n');
    } else {
      console.log('⚠️  LIVE MODE: Commits will be created and pushed!\n');
    }

    for (let i = 0; i < commitDates.length; i++) {
      const ts = commitDates[i];
      const iso = ts.toISOString(); // Git likes ISO for env vars
      const shortDate = ts.format("YYYY-MM-DD HH:mm:ss");
      const message = commitMessages[i];

      // write a file with changing content to have something to commit
      const data = {
        generatedAt: new Date().toISOString(),
        commitIndex: i + 1,
        timestamp: iso,
      };

      if (DRY_RUN) {
        // only simulate
        if ((i + 1) % 20 === 0 || i === commitDates.length - 1) {
          console.log(`Simulated ${i + 1}/${commitDates.length} -> ${shortDate} : ${message}`);
        }
        continue;
      }

      await fs.writeFile(OUT_PATH, JSON.stringify(data, null, 2));

      // set env vars so the commit has the intended author/committer dates
      // store previous values to restore later
      const prevAuthor = process.env.GIT_AUTHOR_DATE;
      const prevCommitter = process.env.GIT_COMMITTER_DATE;
      process.env.GIT_AUTHOR_DATE = iso;
      process.env.GIT_COMMITTER_DATE = iso;

      // stage and commit with explicit date
      // Use -f flag to force add even if file is in .gitignore
      await git.raw(['add', '-f', OUT_PATH]);

      // Use raw commit to ensure date is used and we can pass --date reliably
      // note: some git versions prefer '--date=<iso>' and env vars; both are set here
      // Also set author using git config values to ensure contributions show on GitHub
      const authorName = gitConfig.name || 'Unknown';
      const authorEmail = gitConfig.email || 'unknown@example.com';
      const authorString = `${authorName} <${authorEmail}>`;
      await git.raw(["commit", "-m", message, "--date", iso, "--author", authorString, "--", OUT_PATH]);

      // restore env vars
      if (prevAuthor === undefined) delete process.env.GIT_AUTHOR_DATE; else process.env.GIT_AUTHOR_DATE = prevAuthor;
      if (prevCommitter === undefined) delete process.env.GIT_COMMITTER_DATE; else process.env.GIT_COMMITTER_DATE = prevCommitter;

      // progress log
      if ((i + 1) % 20 === 0 || i === commitDates.length - 1) {
        console.log(`Created ${i + 1}/${commitDates.length} commits — last: ${shortDate} : ${message}`);
      }

      // small delay to avoid overwhelming the local git process
      await delay(randomInt(100, 450));
    }

    // push to remote
    if (!DRY_RUN) {
      console.log("\nPushing to remote 'origin' ...");
      try {
        // Try to get current branch name, fallback to 'main'
        const currentBranch = await git.revparse(['--abbrev-ref', 'HEAD']).catch(() => 'main');
        const branchName = currentBranch.trim() || 'main';
        console.log(`Pushing to branch: ${branchName}`);
        await git.push("origin", branchName);
        console.log("✅ Push complete.");
      } catch (pushErr) {
        console.warn("⚠️  Push failed (this is okay if remote doesn't exist or you need to set up remote):", pushErr.message);
        console.log("   You can push manually later with: git push origin <branch-name>");
      }
    } else {
      console.log("Dry-run finished. No pushes performed.");
    }

    console.log("\n✅ Done.");
  } catch (err) {
    console.error("Error:", err);
    process.exitCode = 1;
  }
}

run();
