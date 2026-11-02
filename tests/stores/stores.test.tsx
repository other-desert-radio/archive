import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { createIndexedDB } from "../../src/database/indexed-db";
import type { StoreName } from "../../src/database/types";
import {
	createStores,
	StoresProvider,
	stores,
	useStores,
} from "../../src/stores";
import { useAudioState } from "../../src/stores/audio";
import fixtureShows from "../res/shows.json";

const fixtureShow = fixtureShows.data[0];
if (!fixtureShow) {
	throw new Error("Expected a show fixture.");
}
const show = fixtureShow;

function TrackProbe() {
	const audio = useStores().audioStore.getSnapshot();
	return (
		<span>{audio.status === "idle" ? "idle" : audio.track.show.title}</span>
	);
}

function ServerSnapshotProbe() {
	return <span>{useAudioState().status}</span>;
}

test("fresh store sets have independent playback and subscriptions", () => {
	const first = createStores();
	const second = createStores();
	assert.notEqual(first.audioStore, second.audioStore);
	assert.notEqual(first.audioStore, stores.audioStore);
	let secondNotifications = 0;
	const unsubscribe = second.audioStore.subscribe(() => secondNotifications++);
	first.audioStore.select({
		show: { ...show, title: "First show" },
		source: { kind: "mixcloud", cloudcastKey: "/dj/first/" },
	});
	assert.deepEqual(second.audioStore.getSnapshot(), { status: "idle" });
	assert.equal(secondNotifications, 0);
	unsubscribe();
});

test("React providers inject the selected store without affecting other trees", () => {
	const first = createStores();
	const second = createStores();
	first.audioStore.select({
		show: { ...show, title: "First show" },
		source: { kind: "mixcloud", cloudcastKey: "/dj/first/" },
	});
	second.audioStore.select({
		show: { ...show, title: "Second show" },
		source: { kind: "samcast", streamUrl: "https://example.com/live" },
	});
	const markup = renderToStaticMarkup(
		<StoresProvider stores={first}>
			<TrackProbe />
			<StoresProvider stores={second}>
				<TrackProbe />
			</StoresProvider>
			<TrackProbe />
		</StoresProvider>,
	);
	assert.equal(
		markup,
		"<span>First show</span><span>Second show</span><span>First show</span>",
	);
});

test("components without an override use the application stores", () => {
	function Probe() {
		assert.equal(useStores(), stores);
		return null;
	}
	renderToStaticMarkup(<Probe />);
});

test("injected playback does not change the idle server hydration snapshot", () => {
	const injected = createStores();
	injected.audioStore.select({
		show: { ...show, title: "Selected show" },
		source: { kind: "mixcloud", cloudcastKey: "/dj/selected/" },
	});
	assert.equal(
		renderToStaticMarkup(
			<StoresProvider stores={injected}>
				<ServerSnapshotProbe />
			</StoresProvider>,
		),
		"<span>idle</span>",
	);
});

test("server rendering never initializes browser storage", () => {
	const injected = createStores();
	const initialize = mock.method(injected, "initialize", async () => {
		throw new Error("Must not initialize during SSR");
	});
	renderToStaticMarkup(
		<StoresProvider stores={injected}>
			<ServerSnapshotProbe />
		</StoresProvider>,
	);
	assert.equal(initialize.mock.callCount(), 0);
});

test("initialization shares one metadata read and passes its result to ShowStore", async () => {
	for (const cached of [{ key: "shows", revision: 12 }, undefined]) {
		const database = createIndexedDB();
		const metadata = database.getObjectStore("metadata");
		const read = mock.method(metadata, "get", async () => cached);
		const getObjectStore = database.getObjectStore.bind(database);
		mock.method(database, "getObjectStore", (name: StoreName) =>
			name === "metadata" ? metadata : getObjectStore(name),
		);
		const injected = createStores(database);
		const initialize = mock.method(
			injected.showStore,
			"initialize",
			async () => {},
		);
		const first = injected.initialize();
		assert.equal(first, injected.initialize());
		await first;
		await injected.initialize();
		assert.deepEqual(
			read.mock.calls.map((call) => call.arguments),
			[["shows"]],
		);
		assert.deepEqual(
			initialize.mock.calls.map((call) => call.arguments),
			[[cached]],
		);
	}
});

test("failed initialization rejects and permits retry", async () => {
	const database = createIndexedDB();
	const metadata = database.getObjectStore("metadata");
	let attempts = 0;
	mock.method(metadata, "get", async () => {
		if (++attempts === 1) {
			throw new Error("Storage unavailable");
		}
		return undefined;
	});
	const getObjectStore = database.getObjectStore.bind(database);
	mock.method(database, "getObjectStore", (name: StoreName) =>
		name === "metadata" ? metadata : getObjectStore(name),
	);
	const injected = createStores(database);
	mock.method(injected.showStore, "initialize", async () => {});
	await assert.rejects(injected.initialize(), /Storage unavailable/);
	await injected.initialize();
	assert.equal(attempts, 2);
});
