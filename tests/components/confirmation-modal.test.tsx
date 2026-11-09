import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import ConfirmationModal from "../../src/components/ConfirmationModal";

test("confirmation content, labels and primary destructive appearance are configurable", () => {
	for (const destructive of [false, true]) {
		const html = renderToStaticMarkup(
			<ConfirmationModal
				ref={() => {}}
				title="Confirm action?"
				body={<p>Configured body</p>}
				primaryAction={{ label: "Proceed", onClick: () => {}, destructive }}
				cancelLabel="Go back"
				pending={false}
				onClose={() => {}}
			/>,
		);
		assert.ok(html.includes("Confirm action?"));
		assert.ok(html.includes("Configured body"));
		assert.ok(html.includes('aria-label="Proceed"'));
		assert.ok(html.includes('aria-label="Go back"'));
		assert.equal(html.includes("button-danger"), destructive);
	}
});
