import { createFacilitatorConfig } from "@coinbase/x402";
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { Scalar } from "@scalar/hono-api-reference";
import { fetcher } from "itty-fetcher";
import invariant from "tiny-invariant";
import { paymentMiddleware } from "x402-hono";

const api = fetcher({ base: "https://ohlcv.artlu.xyz" });

const app = new OpenAPIHono<{ Bindings: CloudflareBindings }>();

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
              schema: z.object({
                status: z.string().openapi({
                  example: "ready",
                }),
              }),
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
  .openapi(
    createRoute({
      method: "get",
      path: "/live",
      summary: "Uptime",
      description: "Returns uptime in seconds",
      tags: ["Health"],
      responses: {
        200: {
          content: {
            "application/json": {
              schema: z.object({
                uptime: z.number().openapi({
                  example: 42069,
                }),
              }),
            },
          },
          description: "Response for status 200",
        },
      },
    }),
    async (c) => {
      const uptime = await api.get<{ uptime: number }>("/live");
      return c.json(uptime);
    }
  )
  .openapi(
    createRoute({
      method: "get",
      path: "/db",
      summary: "Database Status",
      description: "Returns database status",
      tags: ["Health"],
      responses: {
        200: {
          content: {
            "application/json": {
              schema: z.object({
                n: z.number().openapi({
                  example: 1,
                }),
                most_stale_5: z.array(
                  z.object({
                    ticker: z.string(),
                    n: z.number(),
                    last: z.string().openapi({
                      example: "2025-11-17T05:15:05.671Z",
                    }),
                  })
                ),
              }),
            },
          },
          description: "Response for status 200",
        },
      },
    }),
    async (c) => {
      const db = await api.get<{
        n: number;
        most_stale_5: { ticker: string; n: number; last: string }[];
      }>("/db");
      return c.json(db);
    }
  )
  .openapi(
    createRoute({
      method: "get",
      path: "/all-ticks",
      summary: "Get all ticks",
      description:
        "Retrieves tick data, including ticker, timestamp, and adjusted close price",
      tags: ["Live Data"],
      responses: {
        200: {
          content: {
            "application/json": {
              schema: z.array(
                z.object({
                  timestamp: z.string().openapi({
                    example: new Date().toISOString(),
                  }),
                  ticker: z.string(),
                  mark: z.number(),
                  source: z.string().openapi({
                    example: "yahoo",
                  }),
                })
              ),
            },
          },
          description: "Array of tick data",
        },
      },
    }),
    async (c) => {
      const ticks = await api.get<
        {
          timestamp: string;
          ticker: string;
          mark: number;
          source: string;
        }[]
      >("/all-ticks");
      return c.json(ticks);
    }
  )
  .openapi(
    createRoute({
      method: "post",
      path: "/force-update",
      summary: "Force live update for all tickers",
      description: "Forces an update of live market data for all known tickers",
      tags: ["Live Data"],
      responses: {
        200: {
          content: {
            "application/json": {
              schema: z.object({
                message: z.string(),
              }),
            },
          },
          description: "Response for status 200",
        },
      },
    }),
    async (c) => {
      const response = await api.post<{ message: string }>("/force-update");
      return c.json(response);
    }
  )
  .openapi(
    createRoute({
      method: "get",
      path: "/chart-data/{ticker}",
      request: {
        params: z.object({ ticker: z.string() }),
        query: z.object({
          start_date: z
            .string()
            .refine((date) => new Date(date).getTime() > 0, {
              message: "Invalid start date",
            })
            .optional(),
          end_date: z
            .string()
            .refine((date) => new Date(date).getTime() > 0, {
              message: "Invalid end date",
            })
            .optional(),
        }),
      },
      summary: "Get chart data for a ticker",
      description:
        "Retrieves chart data for a ticker, including ticker, timestamp, and adjusted close price",
      tags: ["Chart Data"],
      responses: {
        200: {
          content: {
            "application/json": {
              schema: z.array(
                z.object({
                  ticker: z.string(),
                  dt_string: z.string(),
                  open_trade: z.number(),
                  high: z.number(),
                  low: z.number(),
                  unadj_close: z.number(),
                  volume: z.number().openapi({
                    example: 0,
                  }),
                  adj_close: z.number(),
                  timestamp: z.string().openapi({
                    example: new Date().toISOString(),
                  }),
                  source: z.string().openapi({
                    example: "yahoo",
                  }),
                })
              ),
            },
          },
          description: "Response for status 200",
        },
      },
    }),
    async (c) => {
      const ticker = c.req.param("ticker");
      const { start_date, end_date } = c.req.query();

      const qs = new URLSearchParams();
      if (start_date) {
        qs.set("start_date", start_date);
      }
      if (end_date) {
        qs.set("end_date", end_date);
      }
      const chartData = await api.get<
        {
          ticker: string;
          dt_string: string;
          open_trade: number;
          high: number;
          low: number;
          unadj_close: number;
          volume: number;
          adj_close: number;
          timestamp: string;
          source: string;
        }[]
      >(`/chart-data/${ticker}?${qs.toString()}`);
      return c.json(chartData);
    }
  )
  .openapi(
    createRoute({
      method: "post",
      path: "/force-update/{ticker}",
      summary: "Force full update for a ticker",
      description:
        "Forces an update of the full chart data for a specific ticker",
      tags: ["Live Data", "Chart Data"],
      request: {
        params: z.object({ ticker: z.string() }),
      },
      responses: {
        200: {
          content: {
            "application/json": {
              schema: z.object({
                message: z.string(),
              }),
            },
          },
          description: "Response for status 200",
        },
      },
    }),
    async (c) => {
      const ticker = c.req.param("ticker");
      const response = await api.post<{ message: string }>(
        `/force-update/${ticker}`
      );
      return c.json(response);
    }
  )
  .use("*", async (c, next) => {
    invariant(c.env.CDP_API_KEY_ID, "CDP_API_KEY_ID is not set");
    invariant(c.env.CDP_API_KEY_SECRET, "CDP_API_KEY_SECRET is not set");
    const facilitator = createFacilitatorConfig(
      c.env.CDP_API_KEY_ID,
      c.env.CDP_API_KEY_SECRET
    );
    invariant(facilitator?.createAuthHeaders, "createAuthHeaders is not set");

    const middleware = paymentMiddleware(
      c.env.ADDRESS as `0x${string}`,
      {
        "/paid": {
          price: "$0.0001",
          network: "base",
          config: {
            description: "Returns gated content",
            inputSchema: {},
            outputSchema: {
              type: "text/plain",
              properties: {
                message: {
                  type: "string",
                  example: "****",
                },
              },
            },
          },
        },
      },
      facilitator,
    );
    return middleware(c, next);
  })
  .get("/paid", async (c) => {
    invariant(c.env.ADDRESS, "ADDRESS is not set");

    return c.text("****");
  })
  .doc("/openapi", {
    openapi: "3.1.0",
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

export default {
  fetch: app.fetch,
  async scheduled(controller: ScheduledController, ctx: ExecutionContext) {
    const startTime = Date.now();
    console.log(
      JSON.stringify({
        type: "cron_triggered",
        cron: controller.cron,
        scheduledTime: controller.scheduledTime,
        timestamp: new Date().toISOString(),
      })
    );

    try {
      await api.post("/force-update");
      const duration = Date.now() - startTime;
      console.log(
        JSON.stringify({
          type: "cron_completed",
          cron: controller.cron,
          duration: `${duration}ms`,
          timestamp: new Date().toISOString(),
        })
      );
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(
        JSON.stringify({
          type: "cron_error",
          cron: controller.cron,
          error: error instanceof Error ? error.message : String(error),
          duration: `${duration}ms`,
          timestamp: new Date().toISOString(),
        })
      );
      throw error;
    }
  },
};
