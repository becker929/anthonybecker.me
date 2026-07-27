import { test } from "node:test";
import assert from "node:assert/strict";
import { listSkills, createSkill, updateSkill, deleteSkill, resolveSkills, isValidSkillName } from "../skills.js";
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

test("updateSkill can rename and change text, rejecting a rename collision", async () => {
  const db = new FakeD1();
  const a = await createSkill(db, { name: "alpha", text: "a text" });
  await createSkill(db, { name: "beta", text: "b text" });

  const renamed = await updateSkill(db, a.id, { name: "gamma", text: "new text" });
  assert.equal(renamed.name, "gamma");
  assert.equal(renamed.text, "new text");

  await assert.rejects(() => updateSkill(db, a.id, { name: "beta" }), /already exists/);
});

test("updateSkill on an unknown id returns null", async () => {
  const db = new FakeD1();
  const result = await updateSkill(db, "nope", { text: "x" });
  assert.equal(result, null);
});

test("deleteSkill removes it from listSkills", async () => {
  const db = new FakeD1();
  const skill = await createSkill(db, { name: "temp", text: "x" });
  assert.equal((await listSkills(db)).length, 1);
  await deleteSkill(db, skill.id);
  assert.equal((await listSkills(db)).length, 0);
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
