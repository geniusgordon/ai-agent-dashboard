import { describe, expect, it } from "vitest";
import { extractDetail } from "./ApprovalBanner";

describe("extractDetail", () => {
  it("returns null for null/undefined input", () => {
    expect(extractDetail(null)).toBeNull();
    expect(extractDetail(undefined)).toBeNull();
  });

  it("returns null for non-object input", () => {
    expect(extractDetail("string")).toBeNull();
    expect(extractDetail(42)).toBeNull();
    expect(extractDetail(true)).toBeNull();
  });

  it("returns null for empty object", () => {
    expect(extractDetail({})).toBeNull();
  });

  it("extracts skill name", () => {
    expect(extractDetail({ skill: "commit" })).toBe("commit");
  });

  it("extracts skill name with args", () => {
    expect(extractDetail({ skill: "commit", args: "-m 'Fix bug'" })).toBe(
      "commit -m 'Fix bug'",
    );
  });

  it("extracts command", () => {
    expect(extractDetail({ command: "npm install" })).toBe("npm install");
  });

  it("extracts file_path", () => {
    expect(extractDetail({ file_path: "/src/index.ts" })).toBe("/src/index.ts");
  });

  it("extracts path", () => {
    expect(extractDetail({ path: "/etc/config" })).toBe("/etc/config");
  });

  it("prefers skill over command when both present", () => {
    expect(extractDetail({ skill: "deploy", command: "npm run deploy" })).toBe(
      "deploy",
    );
  });

  it("prefers command over file_path when both present", () => {
    expect(
      extractDetail({ command: "cat foo.txt", file_path: "foo.txt" }),
    ).toBe("cat foo.txt");
  });
});
