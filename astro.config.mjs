// @ts-check
import { defineConfig } from "astro/config";

import react from "@astrojs/react";

// https://astro.build/config
export default defineConfig({
	output: "static",
	site: "https://other-desert-radio.github.io",
	base: "/archive-site",
	integrations: [react()],
	vite: {
		plugins: [
			{
				// Keep builds from overwriting the dev server's React JSX runtime cache,
				// which causes hydrated components to disappear after a refresh.
				name: "separate-dependency-caches",
				config: (_config, { command, mode }) => ({
					cacheDir: `node_modules/.vite-${command}-${mode}`,
				}),
			},
		],
	},
});
