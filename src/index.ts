import { Hono } from "hono";
import invariant from "tiny-invariant";
import { paymentMiddleware , type Resource} from "x402-hono";

const SHORT_CIRCUIT = false;
const BASE_URL = "https://artlu.xyz";

const app = new Hono<{ Bindings: CloudflareBindings }>({
	strict: false, // allow trailing slashes to match routes
});

app
	.get("/health", async (c) => {
		return c.json({ uptime: 42069 });
	})
	.use("*", async (c, next) => {
		if (SHORT_CIRCUIT) {
			return next();
		}
		invariant(c.env.FACILITATOR_URL, "FACILITATOR_URL is not set");

		const middleware = paymentMiddleware(
			c.env.ADDRESS as `0x${string}`,
			{
				"/paid": {
					price: "$0.001",
					network: "base",
					config: {
						description: "Static testing",
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
				"/gated/*": {
					price: "$10.00",
					network: "base",
					config: {
						description: "Gated post",
					},
				},
			},
			{ url: c.env.FACILITATOR_URL as Resource },
		);
		return middleware(c, next);
	})
	.get("/gated/:slug", async (c) => {
		const slug = c.req.param("slug");

		const username = c.env.BASIC_AUTH_USER;
		const password = c.env.BASIC_AUTH_PASSWORD;
    invariant(username, "BASIC_AUTH_USER is not set");
    invariant(password, "BASIC_AUTH_PASSWORD is not set");

		const headers = new Headers(c.req.header());
		headers.set("Authorization", `Basic ${btoa(`${username}:${password}`)}`);
		const upstream = await fetch(`${BASE_URL}/paid/${slug}`, {
			method: c.req.method,
			headers,
		});

    return upstream;
	})
	.get("/paid", async (c) => {
		invariant(c.env.ADDRESS, "ADDRESS is not set");

		return c.json({ message: "*****" });
	})
	.all("*", async (c) => {
    // proxy the other requests, such as css files and images
		// Build the upstream URL with path and query string
		const url = new URL(c.req.url);
		const pathname = url.pathname;
		const upstreamUrl = `${BASE_URL}${pathname}${url.search}`;
		// Create a new request with the upstream URL, preserving everything else
		const upstreamRequest = new Request(upstreamUrl, c.req.raw);

		const upstream = await fetch(upstreamRequest);
		return upstream;
	});

export default app;
