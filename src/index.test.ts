import { describe, expect, it } from "vitest";
import app from "./index";


describe("Test the application", () => {
  it("Should return 200 response", async () => {
    const res = await app.fetch(new Request("http://localhost/health"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ uptime: 42069 });
  });
});
