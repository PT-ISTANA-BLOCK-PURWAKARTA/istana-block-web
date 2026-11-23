import { describe, expect, it } from "vitest";
import { escapeLike, isValidLoginId, isValidUsername, LoginIdSchema, normalizeLoginId } from "../login-id";

describe("login-id validation (email atau username)", () => {
  it("normalizes whitespace and case", () => {
    expect(normalizeLoginId("  Admin@IstanaBlock.COM  ")).toBe("admin@istanablock.com");
    expect(normalizeLoginId("  Rina.Kantor ")).toBe("rina.kantor");
  });

  it("accepts valid email addresses", () => {
    expect(isValidLoginId("admin@istanablock.com")).toBe(true);
    expect(isValidLoginId("rina.keuangan+ops@istanablock.co.id")).toBe(true);
    expect(LoginIdSchema.safeParse("  Admin@IstanaBlock.com ").data).toBe("admin@istanablock.com");
  });

  it("accepts valid usernames", () => {
    expect(isValidUsername("qc")).toBe(true);
    expect(isValidUsername("admin")).toBe(true);
    expect(isValidUsername("rina.kantor")).toBe(true);
    expect(isValidUsername("staf_gudang-01")).toBe(true);
    expect(isValidLoginId("Admin_Kantor")).toBe(true);
    expect(LoginIdSchema.safeParse("  Rina_01 ").data).toBe("rina_01");
  });

  it("rejects invalid emails and usernames", () => {
    expect(isValidLoginId("")).toBe(false);
    expect(isValidLoginId("a")).toBe(false);
    expect(isValidLoginId("nama pakai spasi")).toBe(false);
    expect(isValidLoginId(".awalan")).toBe(false);
    expect(isValidLoginId("akhiran.")).toBe(false);
    expect(isValidLoginId("dua..titik")).toBe(false);
    expect(isValidLoginId("bukan@email")).toBe(false);
    expect(isValidLoginId("@istanablock.com")).toBe(false);
    expect(isValidLoginId("user!name")).toBe(false);
    expect(LoginIdSchema.safeParse("bad user!").success).toBe(false);
  });

  it("escapes LIKE wildcards safely", () => {
    expect(escapeLike("admin_1%test\\x")).toBe("admin\\_1\\%test\\\\x");
  });
});
