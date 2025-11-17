import { z } from "@hono/zod-openapi";
import { createRoute } from "@hono/zod-openapi";
import { OpenAPIHono } from "@hono/zod-openapi";
import { Scalar } from "@scalar/hono-api-reference";

const app = new OpenAPIHono();

app
  .openapi(
    createRoute({
      method: "get",
      path: "/ready",
      summary: "Ready check",
      description: "Returns ready status",
      tags: ["Health"],
      responses: {
        200: {
          content: {
            "application/json": {
              schema: z
                .object({
                  status: z.string().openapi({
                    example: "ready",
                  }),
                })
            },
          },
          description: "Response for status 200",
        },
      },
    }),
    (c) => {
      return c.json({
        status: "ready",
      });
    }
  )

  .doc("/openapi", {
    openapi: "3.0.0",
    info: {
      version: "1.0.0",
      title: "OHLCV API",
      description: "API for OHLCV data",
      contact: {
        name: "artlu99",
        url: "https://github.com/artlu99/ohlcv",
      },
      license: {
        name: "MIT",
        url: "https://github.com/artlu99/ohlcv?tab=MIT-1-ov-file#readme",
      },
    },
  })
  .get("/docs", Scalar({ url: "/openapi" }));

export default app;
