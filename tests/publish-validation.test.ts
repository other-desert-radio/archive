import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

test("Pages validates built resources before upload and deployment depends on the gate", async () => {
	const workflow = await readFile(".github/workflows/deploy-pages.yml", "utf8");
	const build = workflow.indexOf("run: bun run build");
	const validate = workflow.indexOf("run: bun run validate:resources");
	const upload = workflow.indexOf("uses: actions/upload-pages-artifact@");
	assert.ok(build >= 0 && validate > build && upload > validate);
	assert.match(workflow, /deploy:\s*\n\s+name:.*\n\s+needs: build/);
	assert.doesNotMatch(workflow, /continue-on-error: true/);
	assert.match(workflow, /workflow_dispatch:/);
});

test("PR and merge-group checks build and validate resources", async () => {
	const workflow = await readFile(".github/workflows/tests.yml", "utf8");
	assert.match(workflow, /pull_request:/);
	assert.match(workflow, /merge_group:/);
	const tests = workflow.indexOf("run: bun run test");
	const build = workflow.indexOf("run: bun run build");
	const validate = workflow.indexOf("run: bun run validate:resources");
	assert.ok(tests >= 0 && build > tests && validate > build);
	assert.doesNotMatch(workflow, /continue-on-error: true/);
});
