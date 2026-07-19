import { describe, expect, it } from "vitest";

import { callbackErrorKey, signInErrorKey } from "@/lib/auth/errors";

describe("signInErrorKey", () => {
  it("returns null when there is no error", () => {
    expect(signInErrorKey(null)).toBeNull();
    expect(signInErrorKey(undefined)).toBeNull();
  });

  it("maps the invitation-only 403 rejection to invitation-required", () => {
    expect(signInErrorKey({ status: 403 })).toBe("invitation-required");
  });

  it("maps rate limiting to rate-limited", () => {
    expect(signInErrorKey({ status: 429 })).toBe("rate-limited");
  });

  it("maps every other failure to a generic request-failed", () => {
    expect(signInErrorKey({ status: 500 })).toBe("request-failed");
    expect(signInErrorKey({ status: 400 })).toBe("request-failed");
    expect(signInErrorKey({})).toBe("request-failed");
  });
});

describe("callbackErrorKey", () => {
  it("maps an expired OTP redirect to link-expired", () => {
    const params = new URLSearchParams(
      "error=access_denied&error_code=otp_expired",
    );
    expect(callbackErrorKey(params)).toBe("link-expired");
  });

  it("maps everything else to link-invalid", () => {
    expect(callbackErrorKey(new URLSearchParams())).toBe("link-invalid");
    expect(callbackErrorKey(new URLSearchParams("error=server_error"))).toBe(
      "link-invalid",
    );
  });
});
