import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import HistoryPane from "../../../src/components/history/HistoryPane";
import { createStores, StoresProvider } from "../../../src/stores";

test("history waits for catalog initialization before looking up shows", () => {
	const stores = createStores();
	const getShow = mock.method(stores.showStore, "get");
	const initialize = mock.method(stores, "initialize");
	const html = renderToStaticMarkup(
		<StoresProvider stores={stores}>
			<HistoryPane />
		</StoresProvider>,
	);
	assert.ok(html.includes('role="status"'));
	assert.ok(html.includes("Loading shows..."));
	assert.ok(html.includes("Loading playlists..."));
	assert.ok(!html.includes("missing show id"));
	assert.equal(getShow.mock.callCount(), 0);
	assert.equal(initialize.mock.callCount(), 0);
});
