import { describe, it, expect } from "vitest";
import { validatePlanConsistency } from "../src/scratch.js";
import type { ScratchPlan } from "../src/types.js";

function plan(overrides: Partial<ScratchPlan> = {}): ScratchPlan {
  return {
    project: { name: "app", summary: "An app." },
    stack: { primaryLanguage: "TypeScript" },
    dataModel: [
      {
        entity: "users",
        fields: [
          { name: "id", type: "uuid", constraints: "PK" },
          { name: "email", type: "text", constraints: "not null" },
        ],
      },
      {
        entity: "posts",
        fields: [
          { name: "id", type: "uuid", constraints: "PK" },
          { name: "authorId", type: "uuid", constraints: "FK -> users.id, not null" },
          { name: "title", type: "text", constraints: "not null" },
        ],
      },
    ],
    interfaces: [
      { method: "tRPC", path: "posts.create", kind: "tRPC mutation", auth: "user" },
      { method: "tRPC", path: "posts.list", kind: "tRPC query", auth: "public" },
    ],
    features: [
      {
        name: "Posts",
        kind: "feature",
        interfaces: ["posts.create", "posts.list"],
        entities: ["posts", "users"],
        writes: ["posts"],
      },
    ],
    ...overrides,
  };
}

describe("validatePlanConsistency — referential integrity", () => {
  it("passes a self-consistent plan with no errors", () => {
    const { errors } = validatePlanConsistency(plan());
    expect(errors).toEqual([]);
  });

  it("errors when a feature references an entity not in dataModel", () => {
    const { errors } = validatePlanConsistency(
      plan({
        features: [{ name: "X", entities: ["ghosts"] }],
      }),
    );
    expect(errors.join("\n")).toMatch(/ghosts/);
    expect(errors.join("\n")).toMatch(/entit/i);
  });

  it("errors when a feature references an interface not in interfaces", () => {
    const { errors } = validatePlanConsistency(
      plan({
        features: [{ name: "X", interfaces: ["posts.delete"] }],
      }),
    );
    expect(errors.join("\n")).toMatch(/posts\.delete/);
    expect(errors.join("\n")).toMatch(/interface|operation/i);
  });

  it("errors when feature.writes names an entity that is not in dataModel", () => {
    const { errors } = validatePlanConsistency(
      plan({
        features: [{ name: "X", entities: ["posts"], writes: ["nope"] }],
      }),
    );
    expect(errors.join("\n")).toMatch(/nope/);
  });
});

describe("validatePlanConsistency — enums", () => {
  it("errors on a declared enum with no members", () => {
    const { errors } = validatePlanConsistency(
      plan({ enums: [{ name: "Role", members: [] }] }),
    );
    expect(errors.join("\n")).toMatch(/Role/);
    expect(errors.join("\n")).toMatch(/member/i);
  });

  it("errors when a field's enumRef points at an undefined enum", () => {
    const p = plan();
    p.dataModel![0]!.fields.push({ name: "role", type: "enum", enumRef: "Role" });
    const { errors } = validatePlanConsistency(p);
    expect(errors.join("\n")).toMatch(/Role/);
  });

  it("warns on an enum-typed field with no members anywhere", () => {
    const p = plan();
    p.dataModel![0]!.fields.push({ name: "role", type: "enum", constraints: "" });
    const { warnings } = validatePlanConsistency(p);
    expect(warnings.join("\n")).toMatch(/role/);
    expect(warnings.join("\n")).toMatch(/enum|member/i);
  });

  it("does not warn when the enum members are inline in constraints", () => {
    const p = plan();
    p.dataModel![0]!.fields.push({
      name: "role",
      type: "enum",
      constraints: "ADMIN | USER",
    });
    const { warnings } = validatePlanConsistency(p);
    expect(warnings.join("\n")).not.toMatch(/role/);
  });

  it("does not warn when the field references a defined enum", () => {
    const p = plan({ enums: [{ name: "Role", members: ["ADMIN", "USER"] }] });
    p.dataModel![0]!.fields.push({ name: "role", type: "enum", enumRef: "Role" });
    const { warnings, errors } = validatePlanConsistency(p);
    expect(errors).toEqual([]);
    expect(warnings.join("\n")).not.toMatch(/role/);
  });
});

describe("validatePlanConsistency — anonymous writes", () => {
  it("warns when a public write targets an entity with a required owner FK", () => {
    const { warnings } = validatePlanConsistency(
      plan({
        interfaces: [
          { method: "tRPC", path: "posts.contact", kind: "tRPC mutation", auth: "public" },
        ],
        features: [
          { name: "Contact", interfaces: ["posts.contact"], entities: ["posts"], writes: ["posts"] },
        ],
      }),
    );
    // posts.authorId is a non-null FK -> users; an anonymous caller can't satisfy it.
    expect(warnings.join("\n")).toMatch(/posts\.contact/);
    expect(warnings.join("\n")).toMatch(/anonymous|public/i);
    expect(warnings.join("\n")).toMatch(/users|FK|owner/i);
  });

  it("does not warn when the anonymous write targets an anon-capable entity", () => {
    const { warnings } = validatePlanConsistency(
      plan({
        dataModel: [
          ...plan().dataModel!,
          {
            entity: "contactRequests",
            fields: [
              { name: "id", type: "uuid", constraints: "PK" },
              { name: "email", type: "text", constraints: "not null" },
              { name: "message", type: "text", constraints: "not null" },
            ],
          },
        ],
        interfaces: [
          { method: "tRPC", path: "posts.contact", kind: "tRPC mutation", auth: "public" },
        ],
        features: [
          {
            name: "Contact",
            interfaces: ["posts.contact"],
            entities: ["contactRequests"],
            writes: ["contactRequests"],
          },
        ],
      }),
    );
    expect(warnings.join("\n")).not.toMatch(/posts\.contact/);
  });

  it("does not warn for an authenticated write to an owner-FK entity", () => {
    const { warnings } = validatePlanConsistency(plan());
    expect(warnings.join("\n")).not.toMatch(/posts\.create/);
  });

  it("does not warn when the public write only sets a RECIPIENT FK (a pre-existing owner, not the caller)", () => {
    const { warnings } = validatePlanConsistency(
      plan({
        dataModel: [
          ...plan().dataModel!,
          {
            entity: "notifications",
            fields: [
              { name: "id", type: "uuid", constraints: "PK" },
              // recipientId points at a pre-existing user (the doctor), supplied as input —
              // an anonymous caller CAN satisfy it; this is not the owner-FK bug.
              { name: "recipientId", type: "uuid", constraints: "FK -> users.id, not null" },
              { name: "message", type: "text", constraints: "not null" },
            ],
          },
        ],
        interfaces: [
          { method: "tRPC", path: "posts.contact", kind: "tRPC mutation", auth: "public" },
        ],
        features: [
          { name: "Contact", interfaces: ["posts.contact"], entities: ["notifications"], writes: ["notifications"] },
        ],
      }),
    );
    expect(warnings.join("\n")).not.toMatch(/posts\.contact/);
  });

  it("still warns when the public write sets the caller's OWN id (senderUserId)", () => {
    const { warnings } = validatePlanConsistency(
      plan({
        dataModel: [
          ...plan().dataModel!,
          {
            entity: "messages",
            fields: [
              { name: "id", type: "uuid", constraints: "PK" },
              { name: "senderUserId", type: "uuid", constraints: "FK -> users.id, not null" },
              { name: "body", type: "text", constraints: "not null" },
            ],
          },
        ],
        interfaces: [
          { method: "tRPC", path: "posts.contact", kind: "tRPC mutation", auth: "public" },
        ],
        features: [
          { name: "Contact", interfaces: ["posts.contact"], entities: ["messages"], writes: ["messages"] },
        ],
      }),
    );
    expect(warnings.join("\n")).toMatch(/posts\.contact/);
    expect(warnings.join("\n")).toMatch(/senderUserId/);
  });
});
