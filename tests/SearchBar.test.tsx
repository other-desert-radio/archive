import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import SearchBar from "../src/components/search/SearchBar";

test("the clear button appears only with a query", () => {
	const onChange = () => {};
	assert.match(
		renderToStaticMarkup(<SearchBar value="jazz" onChange={onChange} />),
		/aria-label="Clear search"/,
	);
	assert.doesNotMatch(
		renderToStaticMarkup(<SearchBar value="" onChange={onChange} />),
		/aria-label="Clear search"/,
	);
});
