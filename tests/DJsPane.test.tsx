import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import DJsPane from "../src/components/dj/DJsPane";

const djs = [
	{
		id: 11,
		title: "DJ AKĀSHA",
		image_small: "images/djs/11.jpg",
		image_large: "images/djs/11_large.jpg",
		tagIds: [1],
	},
	{
		id: 16,
		title: "DJ Emocean",
		image_small: "images/djs/16.png",
		image_large: "images/djs/16_large.png",
		tagIds: [],
	},
];

const tags = new Map([[1, { id: 1, title: "Ambient", color: "#000000" }]]);

test("renders an empty message when no DJs are supplied", () => {
	const markup = renderToStaticMarkup(
		<DJsPane base="/archive-site/" djs={[]} tags={tags} />,
	);

	assert.equal(markup, "<p>No DJs found.</p>");
});

test("renders base-aware links for supplied DJs", () => {
	const markup = renderToStaticMarkup(
		<DJsPane base="/archive-site/" djs={djs} tags={tags} />,
	);

	assert.match(markup, /href="\/archive-site\/djs\/11"/);
	assert.match(markup, /href="\/archive-site\/djs\/16"/);
	assert.match(markup, /src="\/archive-site\/images\/djs\/11.jpg"/);
	assert.match(
		markup,
		/<img[^>]+src="\/archive-site\/images\/djs\/16.png"[^>]+alt="DJ Emocean"/,
	);
	assert.match(markup, /<img[^>]+alt="DJ AKĀSHA"/);
	const images = markup.match(/<img\b[^>]*>/g) ?? [];
	assert.equal(images.length, djs.length);
	for (const image of images) {
		assert.match(image, /loading="lazy"/);
		assert.match(image, /decoding="async"/);
	}
	assert.doesNotMatch(markup, /_large/);
	assert.doesNotMatch(markup, /\/archive-site\/\//);
	assert.match(markup, />DJ AKĀSHA</);
	assert.match(markup, />DJ Emocean</);
	assert.match(markup, />Ambient</);
});

test("logs an error and skips a missing tag", () => {
	const originalError = console.error;
	const errors: string[] = [];
	console.error = (message: string) => errors.push(message);

	try {
		const markup = renderToStaticMarkup(
			<DJsPane base="/archive-site/" djs={djs} tags={new Map()} />,
		);

		assert.doesNotMatch(markup, />Ambient</);
		assert.deepEqual(errors, ["Tag 1 does not exist."]);
	} finally {
		console.error = originalError;
	}
});
