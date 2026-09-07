import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getPromptVersion,
  getCurrentPrompt,
  listPromptVersions,
  listCurrentPrompts,
  createPromptVersion,
  portraitSystemPrompt,
  currentStyleVersion,
  flavorSystemPrompt,
  currentFlavorPromptVersion,
  gemSystemPrompt,
  gemFieldFillSystemPrompt,
  GENERATORS,
} from "../prompts.js";
import { createSkill } from "../skills.js";
import { FakeD1 } from "./fakes.js";

test("getCurrentPrompt lazily seeds a generator's first version on first read", async () => {
  const db = new FakeD1();
  assert.equal(db.prompts.size, 0);
  const current = await getCurrentPrompt(db, "portrait");
  assert.equal(current.version, 2, "portrait's seed history ends at v2");
  assert.ok(db.prompts.size > 0, "seeding must have written rows");
});

test("seeding is idempotent — a second read doesn't duplicate rows", async () => {
  const db = new FakeD1();
  await getCurrentPrompt(db, "flavor");
  const countAfterFirst = db.prompts.size;
  await getCurrentPrompt(db, "flavor");
  assert.equal(db.prompts.size, countAfterFirst);
});

test("every generator seeds independently and all four are listed", async () => {
  const db = new FakeD1();
  const rows = await listCurrentPrompts(db);
  assert.deepEqual(rows.map((r) => r.generator).sort(), [...GENERATORS].sort());
  for (const row of rows) assert.equal(typeof row.text, "string");
});

test("createPromptVersion appends the next version and never overwrites", async () => {
  const db = new FakeD1();
  await getCurrentPrompt(db, "flavor"); // seeds v1
  const created = await createPromptVersion(db, "flavor", "New flavor prompt text.");
  assert.equal(created.version, 2);

  const v1 = await getPromptVersion(db, "flavor", 1);
  assert.notEqual(v1.text, "New flavor prompt text.", "v1 must be untouched");
  const current = await getCurrentPrompt(db, "flavor");
  assert.equal(current.version, 2);
  assert.equal(current.text, "New flavor prompt text.");
});

test("createPromptVersion rejects empty text", async () => {
  const db = new FakeD1();
  await assert.rejects(() => createPromptVersion(db, "flavor", "   "), /required/);
});

test("createPromptVersion rejects a gem prompt that dropped {{key_color}}", async () => {
  const db = new FakeD1();
  await getCurrentPrompt(db, "gem"); // seeds v1
  await assert.rejects(
    () => createPromptVersion(db, "gem", "A nice gem, no placeholder anywhere."),
    /key_color/,
  );
  // The rejected save must not have appended a version.
  assert.equal((await getCurrentPrompt(db, "gem")).version, 1);
});

test("the {{key_color}} guard applies only to the gem generator", async () => {
  const db = new FakeD1();
  const created = await createPromptVersion(db, "flavor", "No placeholder needed here.");
  assert.equal(created.version, 2);
});

test("createPromptVersion and getPromptVersion reject an unknown generator", async () => {
  const db = new FakeD1();
  await assert.rejects(() => createPromptVersion(db, "nope", "x"), /Unknown generator/);
});

test("getPromptVersion rejects an unknown version number for a known generator", async () => {
  const db = new FakeD1();
  await assert.rejects(() => getPromptVersion(db, "flavor", 999), /Unknown flavor prompt version 999/);
});

test("listPromptVersions returns newest first", async () => {
  const db = new FakeD1();
  await getCurrentPrompt(db, "flavor"); // seeds v1
  await createPromptVersion(db, "flavor", "v2 text");
  await createPromptVersion(db, "flavor", "v3 text");
  const versions = await listPromptVersions(db, "flavor");
  assert.deepEqual(versions.map((v) => v.version), [3, 2, 1]);
});

test("portraitSystemPrompt resolves /name skills and defaults to the current style version", async () => {
  const db = new FakeD1();
  await createSkill(db, { name: "no-frame", text: "absolutely no card frame or border" });
  await createPromptVersion(db, "portrait", "Paint a portrait. /no-frame Keep it simple.");

  const version = await currentStyleVersion(db);
  assert.equal(version, 3); // v1, v2 seeded, then the new one just created

  const resolved = await portraitSystemPrompt(db, version);
  assert.equal(resolved, "Paint a portrait. absolutely no card frame or border Keep it simple.");
});

test("portraitSystemPrompt can still fetch an older, unresolved-differently version by number", async () => {
  const db = new FakeD1();
  await getCurrentPrompt(db, "portrait"); // seeds v1, v2
  const v1Text = await portraitSystemPrompt(db, 1);
  assert.match(v1Text, /filling most of the vertical space/);
});

test("flavorSystemPrompt and currentFlavorPromptVersion round-trip through the seed", async () => {
  const db = new FakeD1();
  const version = await currentFlavorPromptVersion(db);
  assert.equal(version, 1);
  const text = await flavorSystemPrompt(db, version);
  assert.match(text, /flavor text/);
});

test("gemFieldFillSystemPrompt resolves skills against the seeded text", async () => {
  const db = new FakeD1();
  const text = await gemFieldFillSystemPrompt(db);
  assert.match(text, /gem's fields/);
});

test("gemSystemPrompt substitutes {{key_color}} after skill resolution", async () => {
  const db = new FakeD1();
  const text = await gemSystemPrompt(db, "#ff00ff");
  assert.match(text, /#ff00ff/);
  assert.doesNotMatch(text, /\{\{key_color\}\}/);
});

test("gemSystemPrompt: a /name skill and {{key_color}} coexist correctly", async () => {
  const db = new FakeD1();
  await createSkill(db, { name: "shiny", text: "extra specular highlights" });
  await createPromptVersion(db, "gem", "Gem on {{key_color}}. /shiny Done.");
  const text = await gemSystemPrompt(db, "#123456");
  assert.equal(text, "Gem on #123456. extra specular highlights Done.");
});
