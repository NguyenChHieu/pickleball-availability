import assert from "node:assert/strict";
import { after, test } from "node:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "pbb-planner-store-"));
process.env.PLANNER_DATA_DIR = dataDir;
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SECRET_KEY;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const {
  createPlannerEvent,
  getPlannerEventView,
  normalizeDisplayNameKey,
  upsertPlannerParticipant,
} = await import("../src/server/plannerStore.ts");

after(async () => {
  await fs.rm(dataDir, { force: true, recursive: true });
});

function eventInput() {
  return {
    name: "Friday hit",
    dateStart: "2026-07-10",
    dateEnd: "2026-07-10",
    preferredStartTime: "18:00",
    preferredEndTime: "22:00",
    minimumDurationMinutes: 60,
    venueIds: ["propickle"],
  };
}

function block(startMinute: number, endMinute: number) {
  return [{ date: "2026-07-10", startMinute, endMinute }];
}

test("normalizes display names for duplicate detection", () => {
  assert.equal(normalizeDisplayNameKey("  Hieu   Nguyen "), "hieu nguyen");
});

test("new planner participants can save without an edit password", async () => {
  const event = await createPlannerEvent(eventInput());
  const created = await upsertPlannerParticipant(event.eventToken, {
    displayName: "Hieu",
    availabilityBlocks: block(18 * 60, 20 * 60),
  });

  assert.ok(created);
  assert.equal(created.editPasswordHash, undefined);
});

test("same browser edit token updates without re-entering password", async () => {
  const event = await createPlannerEvent(eventInput());
  const created = await upsertPlannerParticipant(event.eventToken, {
    displayName: "Hieu",
    availabilityBlocks: block(18 * 60, 19 * 60),
  });
  assert.ok(created);

  const updated = await upsertPlannerParticipant(event.eventToken, {
    displayName: "Hieu",
    editToken: created.editToken,
    availabilityBlocks: block(19 * 60, 21 * 60),
  });

  assert.equal(updated?.participantId, created.participantId);
  assert.deepEqual(updated?.availabilityBlocks, block(19 * 60, 21 * 60));
});

test("passwordless participant cannot be reclaimed from another browser", async () => {
  const event = await createPlannerEvent(eventInput());
  await upsertPlannerParticipant(event.eventToken, {
    displayName: "Hieu",
    availabilityBlocks: block(18 * 60, 19 * 60),
  });

  await assert.rejects(
    upsertPlannerParticipant(event.eventToken, {
      displayName: "hieu",
      editPassword: "newpass1",
      availabilityBlocks: block(20 * 60, 21 * 60),
    }),
    /no recovery password/
  );
});

test("same name and password can reclaim a participant from another browser", async () => {
  const event = await createPlannerEvent(eventInput());
  const created = await upsertPlannerParticipant(event.eventToken, {
    displayName: "Hieu",
    editPassword: "court123",
    availabilityBlocks: block(18 * 60, 19 * 60),
  });
  assert.ok(created);

  const reclaimed = await upsertPlannerParticipant(event.eventToken, {
    displayName: "hieu",
    editPassword: "court123",
    availabilityBlocks: block(20 * 60, 21 * 60),
  });

  assert.equal(reclaimed?.participantId, created.participantId);
  assert.equal(reclaimed?.displayName, "hieu");
  assert.deepEqual(reclaimed?.availabilityBlocks, block(20 * 60, 21 * 60));
});

test("same name with wrong or missing password is rejected", async () => {
  const event = await createPlannerEvent(eventInput());
  await upsertPlannerParticipant(event.eventToken, {
    displayName: "Hieu",
    editPassword: "court123",
    availabilityBlocks: block(18 * 60, 19 * 60),
  });

  await assert.rejects(
    upsertPlannerParticipant(event.eventToken, {
      displayName: "hieu",
      availabilityBlocks: block(20 * 60, 21 * 60),
    }),
    /already used/
  );
  await assert.rejects(
    upsertPlannerParticipant(event.eventToken, {
      displayName: "HIEU",
      editPassword: "wrongpass",
      availabilityBlocks: block(20 * 60, 21 * 60),
    }),
    /already used/
  );
});

test("legacy localStorage-token participants can set a password on next save", async () => {
  const legacyToken = "legacy-event";
  const createdAt = "2026-07-10T00:00:00.000Z";
  await fs.writeFile(
    path.join(dataDir, `${legacyToken}.json`),
    `${JSON.stringify(
      {
        event: { ...eventInput(), eventToken: legacyToken, createdAt },
        participants: [
          {
            participantId: "legacy-participant",
            eventToken: legacyToken,
            displayName: "Legacy",
            editToken: "legacy-edit",
            availabilityBlocks: block(18 * 60, 19 * 60),
            createdAt,
          },
        ],
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  const updated = await upsertPlannerParticipant(legacyToken, {
    displayName: "Legacy",
    editToken: "legacy-edit",
    editPassword: "newpass1",
    availabilityBlocks: block(19 * 60, 20 * 60),
  });
  const reclaimed = await upsertPlannerParticipant(legacyToken, {
    displayName: "legacy",
    editPassword: "newpass1",
    availabilityBlocks: block(20 * 60, 21 * 60),
  });

  assert.equal(updated?.participantId, "legacy-participant");
  assert.equal(reclaimed?.participantId, "legacy-participant");
});

test("public planner view never exposes edit tokens or password hashes", async () => {
  const event = await createPlannerEvent(eventInput());
  await upsertPlannerParticipant(event.eventToken, {
    displayName: "Hieu",
    editPassword: "court123",
    availabilityBlocks: block(18 * 60, 20 * 60),
  });

  const view = await getPlannerEventView(event.eventToken);
  const serialized = JSON.stringify(view);
  assert.ok(view?.participants[0]);
  assert.equal("editToken" in view.participants[0], false);
  assert.equal("editPasswordHash" in view.participants[0], false);
  assert.equal(serialized.includes("court123"), false);
  assert.equal(serialized.includes("scrypt-v1"), false);
});
