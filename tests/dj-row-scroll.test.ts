import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { transpileModule } from "typescript";

test("DJ scrolling eases, reverses, pauses for interaction and cleans up", () => {
	let callback: (time: number) => void = () => {};
	let cancelled = false;
	let reduced = false;
	let focused = false;
	let hovered = false;
	const events = new EventTarget();
	const row = Object.assign(events, {
		scrollLeft: 0,
		scrollWidth: 200,
		clientWidth: 100,
		matches: (selector: string) => (selector === ":hover" ? hovered : focused),
	});
	const source = readFileSync(
		"src/components/explore/dj-row-scroll.ts",
		"utf8",
	);
	const setup = runInNewContext(
		`${transpileModule(source.replace("export function", "function"), { compilerOptions: {} }).outputText}\nsetupDJRowScroll`,
		{
			AbortController,
			window: events,
			document: { hidden: false },
			matchMedia: (query: string) => ({
				get matches() {
					return query.includes("reduced-motion") ? reduced : true;
				},
			}),
			requestAnimationFrame: (next: (time: number) => void) => {
				callback = next;
				return 1;
			},
			cancelAnimationFrame: () => {
				cancelled = true;
			},
		},
	);
	const cleanup = setup(row);
	let time = 0;
	const tick = () => {
		time += 50;
		callback(time);
	};
	callback(0);
	tick();
	const firstStep = row.scrollLeft;
	assert.ok(
		firstStep > 0 && firstStep < 3,
		"gentle start below cruising speed",
	);
	tick();
	assert.ok(row.scrollLeft - firstStep > firstStep, "accelerates smoothly");
	for (let i = 0; i < 20; i++) {
		tick();
	}
	hovered = true;
	const beforeHover = row.scrollLeft;
	tick();
	const stoppingStep = row.scrollLeft - beforeHover;
	assert.ok(stoppingStep > 0 && stoppingStep < 3, "hover eases to a stop");
	for (let i = 0; i < 40; i++) {
		tick();
	}
	const stopped = row.scrollLeft;
	tick();
	assert.equal(row.scrollLeft, stopped, "hover eventually stops completely");
	hovered = false;
	let reachedEnd = false;
	let reachedFront = false;
	for (let i = 0; i < 300; i++) {
		tick();
		assert.ok(row.scrollLeft >= 0 && row.scrollLeft <= 100);
		if (row.scrollLeft === 100) {
			reachedEnd = true;
		}
		if (reachedEnd && row.scrollLeft === 0) {
			reachedFront = true;
			break;
		}
	}
	assert.ok(reachedEnd && reachedFront, "reverses at both ends");
	tick();
	assert.ok(
		row.scrollLeft > 0 && row.scrollLeft < 3,
		"gentle restart after reversal",
	);
	for (const pause of ["reduced", "focus", "drag"]) {
		reduced = pause === "reduced";
		focused = pause === "focus";
		if (pause === "drag") {
			events.dispatchEvent(new Event("pointerdown"));
		}
		const before = row.scrollLeft;
		tick();
		assert.equal(row.scrollLeft, before, pause);
	}
	events.dispatchEvent(new Event("pointerup"));
	row.scrollWidth = 100;
	const before = row.scrollLeft;
	tick();
	assert.equal(row.scrollLeft, before, "no overflow stays still");
	cleanup();
	assert.equal(cancelled, true);
});
