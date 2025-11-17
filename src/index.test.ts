import app from "./index";
import { describe, it, expect } from "vitest";

describe("Test the application", () => {
  it("Should return 200 response", async () => {
    const res = await app.request("http://localhost/hello");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("Hello Hono!");
  });
});
