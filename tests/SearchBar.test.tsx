import assert from "node:assert/strict";
import { test } from "node:test";
import { Children, isValidElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import SearchBar from "../src/components/search/SearchBar";

test("the clear button appears only with a query and clears it", () => {
	let query = "jazz";
	const onChange = (value: string) => {
		query = value;
	};
	const element = SearchBar({ value: query, onChange });
	assert.match(renderToStaticMarkup(element), /aria-label="Clear search"/);
	assert.ok(isValidElement<{ children: React.ReactNode }>(element));
	const button = Children.toArray(element.props.children).find(
		(child) => isValidElement(child) && child.type === "button",
	);
	assert.ok(isValidElement<{ onClick: () => void }>(button));
	button.props.onClick();
	assert.equal(query, "");
	assert.doesNotMatch(
		renderToStaticMarkup(<SearchBar value={query} onChange={onChange} />),
		/aria-label="Clear search"/,
	);
});
