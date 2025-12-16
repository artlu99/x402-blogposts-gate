import { Hono } from "hono";
import invariant from "tiny-invariant";
import { paymentMiddleware, type Resource, type RoutesConfig } from "x402-hono";

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

		// Build payment config dynamically based on actual request path
		const requestPath = new URL(c.req.url).pathname;
		const baseConfig: RoutesConfig = {
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
		};

		// If the request path matches /gated/* pattern, add it to config
		// Handle paths with and without trailing slashes, to ensure payment works for both cases
		if (requestPath.startsWith("/gated/")) {
			// Normalize path (remove trailing slash except for root)
			const normalizedPath =
				requestPath !== "/" && requestPath.endsWith("/")
					? requestPath.slice(0, -1)
					: requestPath;

			const routeConfig = {
				price: "$0.01",
				network: "base" as const,
				config: {
					description: "Gated post",
					outputSchema: {
						type: "text/html",
						properties: {},
					},
				},
			};

			// Add config for the exact request path
			baseConfig[requestPath] = routeConfig;

			// Also add config for normalized path (without trailing slash)
			// This ensures payment works whether URL has trailing slash or not
			if (normalizedPath !== requestPath) {
				baseConfig[normalizedPath] = routeConfig;
			}
		}

		const middleware = paymentMiddleware(
			c.env.ADDRESS as `0x${string}`,
			baseConfig,
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

		// If upstream fails, log but still return it
		if (!upstream.ok) {
			console.error(
				`Upstream fetch failed: ${upstream.status} ${upstream.statusText} for /paid/${slug}`,
			);
		}

		// Read the body and create a new response that Hono can properly track
		// This preserves and ensures paymentMiddleware can access body and c.res.status
		const body = await upstream.text();
		return new Response(body, {
			status: upstream.status,
			statusText: upstream.statusText,
			headers: upstream.headers,
		});
	})
	.get("/paid", async (c) => {
		invariant(c.env.ADDRESS, "ADDRESS is not set");

		return c.json({ message: "*****" });
	})
	.all("*", async (c) => {
		// proxy other requests, such as css files and images
		const url = new URL(c.req.url);
		const pathname = url.pathname;
		const upstreamUrl = `${BASE_URL}${pathname}${url.search}`;
		// Create a new request with the upstream URL, preserving everything else
		const upstreamRequest = new Request(upstreamUrl, c.req.raw);

		const upstream = await fetch(upstreamRequest);
		return upstream;
	});

export default app;
