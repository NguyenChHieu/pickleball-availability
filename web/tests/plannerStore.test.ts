import assert from "node:assert/strict";
import { after, test } from "node:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "pbb-planner-store-"));
const availabilityDataDir = await fs.mkdtemp(path.join(os.tmpdir(), "pbb-availability-store-"));
process.env.PLANNER_DATA_DIR = dataDir;
process.env.AVAILABILITY_DATA_DIR = availabilityDataDir;
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SECRET_KEY;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const {
  createPlannerEvent,
  getPlannerEventView,
  normalizeDisplayNameKey,
  upsertPlannerParticipant,
} = await import("../src/server/plannerStore.ts");
const { saveAvailability } = await import("../src/server/availabilityStore.ts");

after(async () => {
  await fs.rm(dataDir, { force: true, recursive: true });
  await fs.rm(availabilityDataDir, { force: true, recursive: true });
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

test("planner event validation rejects impossible dates and deduplicates venues", async () => {
  await assert.rejects(createPlannerEvent({ ...eventInput(), dateStart: "2026-02-31" }), /valid planner date/);

  const event = await createPlannerEvent({ ...eventInput(), venueIds: ["propickle", "propickle"] });
  assert.deepEqual(event.venueIds, ["propickle"]);

  const normalizedTimes = await createPlannerEvent({
    ...eventInput(),
    preferredStartTime: "6pm",
    preferredEndTime: "10pm",
  });
  assert.equal(normalizedTimes.preferredStartTime, "18:00");
  assert.equal(normalizedTimes.preferredEndTime, "22:00");
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
    /Could not verify edit access/
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

test("recovering a participant loads identity without overwriting availability", async () => {
  const event = await createPlannerEvent(eventInput());
  const created = await upsertPlannerParticipant(event.eventToken, {
    displayName: "Hieu",
    editPassword: "court123",
    availabilityBlocks: block(18 * 60, 20 * 60),
  });
  assert.ok(created);

  const recovered = await upsertPlannerParticipant(event.eventToken, {
    displayName: "hieu",
    editPassword: "court123",
    recoverOnly: true,
    availabilityBlocks: block(20 * 60, 21 * 60),
  });

  assert.equal(recovered?.participantId, created.participantId);
  assert.deepEqual(recovered?.availabilityBlocks, block(18 * 60, 20 * 60));
});

test("participant availability must stay inside event dates and hours", async () => {
  const event = await createPlannerEvent(eventInput());

  await assert.rejects(
    upsertPlannerParticipant(event.eventToken, {
      displayName: "Hieu",
      availabilityBlocks: [{ date: "2026-07-11", startMinute: 18 * 60, endMinute: 19 * 60 }],
    }),
    /inside the planner dates and hours/
  );
  await assert.rejects(
    upsertPlannerParticipant(event.eventToken, {
      displayName: "Hieu",
      availabilityBlocks: [{ date: "2026-07-10", startMinute: 18 * 60 + 15, endMinute: 19 * 60 }],
    }),
    /30-minute slots/
  );
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
    /Could not verify edit access/
  );
  await assert.rejects(
    upsertPlannerParticipant(event.eventToken, {
      displayName: "HIEU",
      editPassword: "wrongpass",
      availabilityBlocks: block(20 * 60, 21 * 60),
    }),
    /Could not verify edit access/
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

test("planner venue matches keep broad venue availability when same-court data is partial", async () => {
  await saveAvailability("propickle", {
    venue_id: "propickle",
    venue_name: "ProPickle",
    exported_at: "2026-07-10T08:00:00.000Z",
    days: [
      {
        booking_date: "2026-07-10",
        open_intervals: [{ start_time: "6:00 PM", end_time: "10:00 PM" }],
        same_court_intervals: [
          {
            court_name: "Court 4",
            intervals: [{ start_time: "7:00 PM", end_time: "8:00 PM" }],
          },
        ],
      },
    ],
  });
  const event = await createPlannerEvent(eventInput());
  await upsertPlannerParticipant(event.eventToken, {
    displayName: "Hieu",
    availabilityBlocks: block(18 * 60, 22 * 60),
  });

  const view = await getPlannerEventView(event.eventToken);
  assert.equal(view?.recommendations.length, 1);
  assert.equal(view?.recommendations[0].startMinute, 18 * 60);
  assert.equal(view?.recommendations[0].endMinute, 22 * 60);
  assert.equal(view?.recommendations[0].confidence, "any-court");
});
