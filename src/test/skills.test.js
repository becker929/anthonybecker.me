import { test } from "node:test";
import assert from "node:assert/strict";
import {
  listSkills,
  createSkill,
  updateSkill,
  archiveSkill,
  unarchiveSkill,
  resolveSkills,
  isValidSkillName,
  findArchivedReferences,
} from "../skills.js";
import { FakeD1 } from "./fakes.js";

test("isValidSkillName accepts lowercase letters/digits/hyphens starting with a letter", () => {
  assert.equal(isValidSkillName("noir-style"), true);
  assert.equal(isValidSkillName("a1"), true);
  assert.equal(isValidSkillName("1a"), false);
  assert.equal(isValidSkillName("-a"), false);
  assert.equal(isValidSkillName("has space"), false);
  assert.equal(isValidSkillName(""), false);
});

test("createSkill normalizes the name to lowercase and rejects duplicates", async () => {
  const db = new FakeD1();
  const skill = await createSkill(db, { name: "Noir-Style", text: "moody, high contrast" });
  assert.equal(skill.name, "noir-style");

  await assert.rejects(() => createSkill(db, { name: "NOIR-STYLE", text: "x" }), /already exists/);
});

test("createSkill rejects an invalid name", async () => {
  const db = new FakeD1();
  await assert.rejects(() => createSkill(db, { name: "has space", text: "x" }), /letter/);
});

test("updateSkill changes text and leaves the name alone (names are immutable)", async () => {
  const db = new FakeD1();
  const a = await createSkill(db, { name: "alpha", text: "a text" });

  const updated = await updateSkill(db, a.id, { name: "gamma", text: "new text" });
  assert.equal(updated.text, "new text");
  assert.equal(updated.name, "alpha", "a rename would orphan existing /alpha references");
});

test("updateSkill on an unknown id returns null", async () => {
  const db = new FakeD1();
  const result = await updateSkill(db, "nope", { text: "x" });
  assert.equal(result, null);
});

test("archiveSkill flags it without removing it from the pool", async () => {
  const db = new FakeD1();
  const skill = await createSkill(db, { name: "retired", text: "old guidance" });
  const archived = await archiveSkill(db, skill.id);
  assert.equal(archived.archived, true);

  const all = await listSkills(db);
  assert.equal(all.length, 1, "archiving must never remove the skill");
  assert.equal(all[0].archived, true);
});

test("an archived skill still resolves for prompts already referencing it", async () => {
  const db = new FakeD1();
  const skill = await createSkill(db, { name: "retired", text: "still expands" });
  await archiveSkill(db, skill.id);
  assert.equal(await resolveSkills(db, "Use /retired here."), "Use still expands here.");
});

test("unarchiveSkill puts it back into normal use", async () => {
  const db = new FakeD1();
  const skill = await createSkill(db, { name: "seasonal", text: "x" });
  await archiveSkill(db, skill.id);
  const restored = await unarchiveSkill(db, skill.id);
  assert.equal(restored.archived, false);
});

test("archive/unarchive on an unknown id returns null", async () => {
  const db = new FakeD1();
  assert.equal(await archiveSkill(db, "nope"), null);
  assert.equal(await unarchiveSkill(db, "nope"), null);
});

test("an archived skill's name stays taken — no reuse under the same name", async () => {
  const db = new FakeD1();
  const skill = await createSkill(db, { name: "taken", text: "original" });
  await archiveSkill(db, skill.id);
  await assert.rejects(() => createSkill(db, { name: "taken", text: "impostor" }), /already exists/);
});

test("findArchivedReferences reports only the archived names a text actually uses", async () => {
  const db = new FakeD1();
  const old = await createSkill(db, { name: "old-tone", text: "x" });
  await createSkill(db, { name: "live-tone", text: "y" });
  await archiveSkill(db, old.id);
  const skills = await listSkills(db);

  assert.deepEqual(findArchivedReferences("Use /old-tone and /live-tone.", skills), ["old-tone"]);
  assert.deepEqual(findArchivedReferences("Only /live-tone here.", skills), []);
  assert.deepEqual(findArchivedReferences("", skills), []);
});

test("resolveSkills expands /name against the current skill pool", async () => {
  const db = new FakeD1();
  await createSkill(db, { name: "no-text", text: "absolutely no text, logos, or watermarks" });
  const resolved = await resolveSkills(db, "Paint a dragon. /no-text Keep it simple.");
  assert.equal(resolved, "Paint a dragon. absolutely no text, logos, or watermarks Keep it simple.");
});

test("resolveSkills is case-insensitive on the reference but not on storage", async () => {
  const db = new FakeD1();
  await createSkill(db, { name: "noir", text: "moody and high-contrast" });
  const resolved = await resolveSkills(db, "Style: /NOIR");
  assert.equal(resolved, "Style: moody and high-contrast");
});

test("resolveSkills leaves an unknown slash command as literal text", async () => {
  const db = new FakeD1();
  await createSkill(db, { name: "known", text: "x" });
  const resolved = await resolveSkills(db, "Use /unknown-skill here.");
  assert.equal(resolved, "Use /unknown-skill here.");
});

test("resolveSkills does not fire mid-word (e.g. inside 'and/or')", async () => {
  const db = new FakeD1();
  await createSkill(db, { name: "or", text: "SHOULD NOT APPEAR" });
  const resolved = await resolveSkills(db, "sword and/or shield");
  assert.equal(resolved, "sword and/or shield");
});

test("resolveSkills handles null/empty text and text with no skills defined", async () => {
  const db = new FakeD1();
  assert.equal(await resolveSkills(db, null), null);
  assert.equal(await resolveSkills(db, ""), "");
  assert.equal(await resolveSkills(db, "/no-skills-exist-yet"), "/no-skills-exist-yet");
});

test("resolveSkills expands every reference to the same skill, live off the current text", async () => {
  const db = new FakeD1();
  const skill = await createSkill(db, { name: "tone", text: "grim" });
  const first = await resolveSkills(db, "/tone and /tone again");
  assert.equal(first, "grim and grim again");

  await updateSkill(db, skill.id, { text: "hopeful" });
  const second = await resolveSkills(db, "/tone and /tone again");
  assert.equal(second, "hopeful and hopeful again", "editing a skill must change future resolutions immediately");
});
