import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import LoadingState from "../src/components/LoadingState";

test("loading state shows an accessible message until content is ready", () => {
	for (const status of ["loading", "error", "ready"] as const) {
		const html = renderToStaticMarkup(
			<LoadingState
				status={status}
				loading="Loading records"
				error="Read failed"
			>
				<div>Records</div>
			</LoadingState>,
		);
		assert.equal(
			html,
			status === "loading"
				? '<p role="status">Loading records</p>'
				: status === "error"
					? '<p role="alert">Read failed</p>'
					: "<div>Records</div>",
		);
	}
});
