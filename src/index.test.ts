import { describe, expect, it } from "bun:test";
import app from "./index";


describe("Test the application", () => {
  it("Should return 200 response", async () => {
        const res = await app.fetch(new Request("http://localhost/health"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(expect.objectContaining({ uptime: 42069 }));
  });
});
