// End-to-end workflow test. Run against a dev/prod server in local mode
// (no APP_PASSWORD) or with APP_PASSWORD exported:
//   BASE_URL=http://localhost:3000 RESUME_PDF=/path/to/resume.pdf node tests/e2e.cjs
// Requires Playwright with a Chromium build available.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
let step = 0;
const ok = (m) => console.log(`✓ ${++step}. ${m}`);

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  // 1 · Sign in
  await page.goto(`${BASE}/companies`);
  assert.match(page.url(), /\/login/);
  if (process.env.APP_PASSWORD) await page.fill('input[name="password"]', process.env.APP_PASSWORD);
  await page.click("form button");
  await page.waitForURL(/\/companies/);
  ok("unauthenticated request redirected to login, sign-in returns to target");

  // 2 · Unauthenticated API is blocked
  const anon = await browser.newContext();
  const r401 = await anon.request.post(`${BASE}/api/ai/chat`, { data: { kind: "assistant", messages: [{ role: "user", content: "hi" }] } });
  assert.equal(r401.status(), 401);
  await anon.close();
  ok("API routes reject requests without a session (401)");

  // 3 · Explorer search & filter
  await page.fill('input[aria-label="Search companies"] >> nth=1', "831");
  await page.waitForSelector("text=Microsoft");
  assert.equal(await page.locator("article").count(), 1);
  ok("company search finds Microsoft by booth #831");

  // 4 · Company profile: status, visited, interaction + follow-up, note
  await page.goto(`${BASE}/companies/ge-aerospace`);
  await page.selectOption('select:near(:text("Networking status"))', "want_to_meet");
  await page.click('button:has-text("Mark visited")');
  await page.waitForSelector('button:has-text("Booth visited")');
  await page.click('summary:has-text("Log an interaction")');
  await page.fill('textarea[name="summary"]', "Spoke with a manufacturing engineer about LPBF process qualification and internships");
  await page.fill('input[name="follow_up"]', "Send thank-you to GE Aerospace engineer");
  await page.click('button:has-text("Log interaction")');
  await page.waitForSelector("text=Interaction saved");
  // The refreshed page (not just the action result) must render the new data.
  await page.waitForSelector("text=Interaction history");
  await page.waitForSelector('button:has-text("Log interaction"):not([disabled])', { state: "attached" });
  await page.fill('textarea[name="body"]', "Booth staff recommended applying to R5029659 before Nov 15");
  await page.click('button:has-text("Add note")');
  await page.waitForSelector("text=Note saved");
  await page.waitForSelector("li >> text=Booth staff recommended applying");
  ok("tracking status, booth visit, interaction, follow-up task and note saved");

  // 5 · Recruiter rules: "confirmed" requires evidence
  await page.click('summary:has-text("Add a recruiter or contact")');
  await page.fill('input[name="full_name"]', "Test Contact");
  await page.check('input[value="confirmed"]');
  await page.fill('input[name="evidence_url"]', "https://example.com/post");
  await page.click('button:has-text("Save recruiter")');
  await page.waitForSelector("text=needs evidence");
  await page.check('input[value="potential"]');
  await page.click('button:has-text("Save recruiter")');
  await page.waitForSelector("text=Recruiter saved");
  ok("recruiter can't be 'confirmed' without evidence; potential contact saved");

  // 6 · Persistence across reload
  await page.reload();
  await page.waitForSelector("text=Spoke with a manufacturing engineer");
  await page.waitForSelector("text=Test Contact");
  ok("data persists across reloads");

  // 7 · CRM board reflects activity
  await page.goto(`${BASE}/crm`);
  await page.waitForSelector('section[aria-label="Met Recruiter"] >> text=GE Aerospace');
  await page.waitForSelector("text=Send thank-you to GE Aerospace engineer");
  ok("CRM pipeline and task list updated");

  // 8 · Jobs: save to tracker, set status applied
  await page.goto(`${BASE}/jobs`);
  await page.locator('button:has-text("Save to tracker")').first().click();
  await page.waitForSelector('button:has-text("In tracker")');
  await page.reload();
  await page.selectOption('select[aria-label="Application status"] >> nth=0', "applied");
  await page.waitForTimeout(800);
  await page.reload();
  assert.equal(await page.locator('select[aria-label="Application status"] >> nth=0').inputValue(), "applied");
  ok("job saved to tracker and application status persisted");

  // 9 · Eligibility reacts to settings
  await page.goto(`${BASE}/profile`);
  await page.selectOption('select[name="usPerson"]', "no");
  await page.selectOption('select[name="sponsorship"]', "needs_future");
  await page.click('button:has-text("Save preferences")');
  await page.waitForSelector("text=Preferences saved");
  await page.goto(`${BASE}/jobs`);
  await page.waitForSelector("text=Explicit restriction identified");
  ok("Honeywell U.S.-person posting flagged as an explicit restriction after the settings change");

  // 10 · Document upload (PDF validation + analysis)
  const bad = path.join(os.tmpdir(), "not-a-pdf.pdf");
  fs.writeFileSync(bad, "hello");
  await page.goto(`${BASE}/profile`);
  await page.setInputFiles('input[name="file"]', bad);
  await page.click('button:has-text("Upload")');
  await page.waitForSelector("text=Only PDF files are accepted");
  if (process.env.RESUME_PDF) {
    await page.setInputFiles('input[name="file"]', process.env.RESUME_PDF);
    await page.click('button:has-text("Upload")');
    await page.waitForSelector("text=Uploaded and analyzed");
    ok("non-PDF rejected by content check; real PDF uploaded and analyzed");
  } else ok("non-PDF rejected by content check (set RESUME_PDF to test a real upload)");

  // 11 · Messages
  await page.goto(`${BASE}/messages?company=ge-aerospace&kind=post_convention`);
  await page.fill('textarea[placeholder^="e.g. LPBF"]', "LPBF qualification across machines");
  await page.click('button:has-text("Regenerate")');
  await page.waitForFunction(() => document.querySelector('textarea[aria-label="Message draft"]')?.value.includes("LPBF qualification across machines"));
  await page.click('button:has-text("Save draft")');
  await page.waitForSelector("text=Draft saved");
  ok("personalized follow-up generated from conversation notes and saved");

  // 12 · Assistant (rules or AI)
  await page.goto(`${BASE}/assistant`);
  await page.click('button:has-text("Which companies have I not visited yet?")');
  await page.waitForSelector("text=/Verified SHPE 2026 participants|\\[Sourced/", { timeout: 120000 });
  ok("assistant answered from the database");

  // 13 · Mock interview
  await page.goto(`${BASE}/coach?company=ge-aerospace`);
  await page.click('button:has-text("I\'m ready to start")');
  await page.waitForSelector("text=Thinking…", { state: "detached", timeout: 120000 });
  await page.waitForFunction(() => document.querySelectorAll('[aria-live="polite"] > div').length >= 3);
  await page.fill('textarea[aria-label="Message"]', "feedback");
  await page.keyboard.press("Enter");
  await page.waitForSelector("text=/Clarity/", { timeout: 120000 });
  ok("mock recruiter conversation and feedback rubric");

  // 14 · CSV import
  const csv = path.join(os.tmpdir(), "import.csv");
  fs.writeFileSync(csv, 'name,industry,verification,evidence,source_url,booth_number\n"E2E Test Co","Aerospace & Defense",verified,"Test evidence",https://example.com/e2e,999\n');
  await page.goto(`${BASE}/data`);
  await page.setInputFiles('input[name="file"]', csv);
  await page.click('button:has-text("Import")');
  await page.waitForSelector("text=Imported 1 companies");
  await page.goto(`${BASE}/companies/e2e-test-co`);
  await page.waitForSelector("text=Booth #999");
  ok("CSV import validated, upserted and visible with booth");

  // 15 · Mobile fair mode
  const m = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, storageState: await ctx.storageState() });
  await m.goto(`${BASE}/fair`);
  await m.fill('input[aria-label="Search company or booth"]', "1121");
  await m.click("text=Mortenson");
  await m.fill('textarea[aria-label="Quick note"]', "Talked about virtual design & construction");
  await m.click('button:has-text("Save note + reminder")');
  await m.waitForSelector("text=follow-up reminder was added");
  const overflow = await m.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  assert.equal(overflow, false);
  ok("fair mode: booth lookup, quick note + reminder, no horizontal overflow on a phone");

  assert.deepEqual(errors, []);
  ok("no uncaught page errors");
  await browser.close();
  console.log(`\nAll ${step} checks passed.`);
})().catch((e) => {
  console.error("E2E FAILED:", e);
  process.exit(1);
});
