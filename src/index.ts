import {
	HTTPFacilitatorClient,
	type RouteConfig,
	type RoutesConfig,
} from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { paymentMiddleware, x402ResourceServer } from "@x402/hono";
import { createPaywall } from "@x402/paywall";
import { evmPaywall } from "@x402/paywall/evm";
import { Hono } from "hono";
import invariant from "tiny-invariant";

const SHORT_CIRCUIT = false;

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

		const baseConfig: RouteConfig = {
			accepts: {
				scheme: "exact",
				price: "$0.001",
				network: "eip155:8453",
				payTo: c.env.ADDRESS as `0x${string}`,
			},
			description: "Static testing",
			mimeType: "text/plain",
		};

		const routes: RoutesConfig = {"/paid": baseConfig};

		const facilitator = new HTTPFacilitatorClient({
			url: c.env.FACILITATOR_URL as string,
		});
		const server = new x402ResourceServer(facilitator).register(
			"eip155:8453",
			new ExactEvmScheme(),
		);

		const paywall = createPaywall().withNetwork(evmPaywall).build();
		return paymentMiddleware(routes, server, undefined, paywall)(c, next);
	})
	.get("/paid", async (c) => {
		invariant(c.env.ADDRESS, "ADDRESS is not set");

		return c.json({ message: "*****" });
	});

export default app;
