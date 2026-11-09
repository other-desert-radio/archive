import assert from "node:assert/strict";
import test from "node:test";
import { formatDateTime } from "../src/utils/format-date";

test("formats an entry update in local time without a year", () => {
	assert.equal(
		formatDateTime(new Date(2026, 6, 10, 10, 1).toISOString()),
		"Jul 10, 10:01am",
	);
	assert.equal(
		formatDateTime(new Date(2026, 6, 10, 22, 1).toISOString()),
		"Jul 10, 10:01pm",
	);
});
