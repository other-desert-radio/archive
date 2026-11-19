import { mock, spyOn } from "bun:test";
import assert from "node:assert/strict";
import { test } from "node:test";
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
import fixtureTags from "../res/tags.json";

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
	assert.notEqual(first.playlistStore, second.playlistStore);
	assert.notEqual(first.playlistStore, stores.playlistStore);
	assert.notEqual(first.showDetailStore, second.showDetailStore);
	assert.notEqual(first.showDetailStore, stores.showDetailStore);
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
	const initialize = spyOn(injected, "initialize").mockImplementation(
		async () => {
			throw new Error("Must not initialize during SSR");
		},
	);
	const playlists = spyOn(
		injected.playlistStore,
		"initialize",
	).mockImplementation(async () => {
		throw new Error("Must not initialize playlists during SSR");
	});
	const details = spyOn(
		injected.showDetailStore,
		"initialize",
	).mockImplementation(async () => {
		throw new Error("Must not initialize details during SSR");
	});
	renderToStaticMarkup(
		<StoresProvider stores={injected}>
			<ServerSnapshotProbe />
		</StoresProvider>,
	);
	assert.equal(initialize.mock.calls.length, 0);
	assert.equal(playlists.mock.calls.length, 0);
	assert.equal(details.mock.calls.length, 0);
});

test("catalog readiness does not start or await details; direct consumers can start them independently", async () => {
	const injected = createStores();
	const catalog = Promise.withResolvers<void>();
	const details = Promise.withResolvers<void>();
	spyOn(injected.versionsStore, "initialize").mockImplementation(
		() => catalog.promise,
	);
	spyOn(injected.showStore, "initialize").mockImplementation(async () => {});
	spyOn(injected.tagStore, "initialize").mockImplementation(async () => {});
	const initializeDetails = spyOn(
		injected.showDetailStore,
		"initialize",
	).mockImplementation(() => details.promise);
	const browsing = injected.initialize();
	assert.equal(initializeDetails.mock.calls.length, 0);
	const direct = injected.showDetailStore.initialize();
	catalog.resolve();
	await browsing;
	details.reject(new Error("Details offline"));
	await assert.rejects(direct, /Details offline/);
	await injected.initialize();
	assert.equal(initializeDetails.mock.calls.length, 1);
});

test("initialization loads shared versions before initializing ShowStore and TagStore", async () => {
	const injected = createStores(createIndexedDB());
	const order: string[] = [];
	const versions = spyOn(
		injected.versionsStore,
		"initialize",
	).mockImplementation(async () => {
		order.push("versions");
	});
	const shows = spyOn(injected.showStore, "initialize").mockImplementation(
		() => {
			order.push("shows");
		},
	);
	const tags = spyOn(injected.tagStore, "initialize").mockImplementation(
		async () => {
			order.push("tags");
		},
	);
	const first = injected.initialize();
	assert.equal(first, injected.initialize());
	await first;
	await injected.initialize();
	assert.deepEqual(order, ["versions", "shows", "tags"]);
	assert.equal(versions.mock.calls.length, 1);
	assert.equal(shows.mock.calls.length, 1);
	assert.equal(tags.mock.calls.length, 1);
});

test("failed initialization rejects and permits retry", async () => {
	const injected = createStores();
	let attempts = 0;
	spyOn(injected.versionsStore, "initialize").mockImplementation(async () => {
		if (++attempts === 1) {
			throw new Error("Storage unavailable");
		}
	});
	spyOn(injected.showStore, "initialize").mockImplementation(() => {});
	spyOn(injected.tagStore, "initialize").mockImplementation(async () => {});
	await assert.rejects(injected.initialize(), /Storage unavailable/);
	await injected.initialize();
	assert.equal(attempts, 2);
});

test("retry refreshes the manifest after a deployment revision mismatch", async () => {
	const database = createIndexedDB();
	const objectStore = database.getObjectStore("shows");
	spyOn(objectStore, "getAll").mockImplementation(async () => []);
	spyOn(database, "getObjectStore").mockImplementation(() => objectStore);
	const write = spyOn(database, "transaction").mockImplementation(
		async () => {},
	);
	const injected = createStores(database);
	const initializeVersions = injected.versionsStore.initialize.bind(
		injected.versionsStore,
	);
	const initializeShows = injected.showStore.initialize.bind(
		injected.showStore,
	);
	spyOn(injected.versionsStore, "initialize").mockImplementation(() =>
		initializeVersions("/archive/"),
	);
	spyOn(injected.showStore, "initialize").mockImplementation(() =>
		initializeShows("/archive/"),
	);
	const initializeTags = injected.tagStore.initialize.bind(injected.tagStore);
	spyOn(injected.tagStore, "initialize").mockImplementation(() =>
		initializeTags("/archive/"),
	);
	let revision = 4;
	let manifestFetches = 0;
	const originalFetch = globalThis.fetch;
	globalThis.fetch = mock(async (url) => {
		if (String(url).endsWith("data_versions.json")) {
			manifestFetches++;
			const version = { id: revision, updatedAt: fixtureShows.updatedAt };
			return Response.json({
				shows: version,
				show_details: version,
				djs: version,
				tags: version,
			});
		}
		return Response.json({
			...(String(url).endsWith("tags.json") ? fixtureTags : fixtureShows),
			version: 5,
		});
	}) as typeof fetch;
	try {
		await assert.rejects(injected.initialize(), /expected 4, received 5/);
		assert.equal(write.mock.calls.length, 0);
		revision = 5;
		const retry = injected.initialize();
		assert.equal(retry, injected.initialize());
		await retry;
		assert.equal(manifestFetches, 2);
		assert.equal(injected.versionsStore.getPublished("shows"), 5);
		assert.deepEqual(injected.showStore.getAll(), fixtureShows.data);
		assert.equal(write.mock.calls.length, 2);
		assert.deepEqual(injected.tagStore.getAll(), fixtureTags.data);
	} finally {
		globalThis.fetch = originalFetch;
	}
});

test("shared initialization awaits ShowStore completion and propagates its errors", async () => {
	const injected = createStores();
	spyOn(injected.versionsStore, "initialize").mockImplementation(
		async () => {},
	);
	const loading = Promise.withResolvers<void>();
	spyOn(injected.showStore, "initialize").mockImplementation(
		() => loading.promise,
	);
	let settled = false;
	const initialize = injected.initialize();
	void initialize.then(
		() => {
			settled = true;
		},
		() => {
			settled = true;
		},
	);
	await Promise.resolve();
	await Promise.resolve();
	assert.equal(settled, false);
	loading.reject(new Error("Show refresh failed"));
	await assert.rejects(initialize, /Show refresh failed/);
});

test("shared initialization awaits tag completion and permits retry after tag failure", async () => {
	const injected = createStores();
	spyOn(injected.versionsStore, "initialize").mockImplementation(
		async () => {},
	);
	spyOn(injected.showStore, "initialize").mockImplementation(async () => {});
	const loading = Promise.withResolvers<void>();
	const tags = spyOn(injected.tagStore, "initialize").mockImplementation(
		() => loading.promise,
	);
	let settled = false;
	const initialization = injected.initialize();
	void initialization.then(
		() => {
			settled = true;
		},
		() => {
			settled = true;
		},
	);
	await new Promise((resolve) => setImmediate(resolve));
	assert.equal(tags.mock.calls.length, 1);
	assert.equal(settled, false);
	loading.reject(new Error("Tag refresh failed"));
	await assert.rejects(initialization, /Tag refresh failed/);
	tags.mockImplementation(async () => {});
	await injected.initialize();
	assert.equal(tags.mock.calls.length, 2);
});

test("playlist initialization remains independent of a failed catalog refresh and is exposed by context", async () => {
	const database = createIndexedDB();
	spyOn(database, "ensureLikedPlaylist").mockImplementation(async () => {});
	const objectStore = database.getObjectStore("playlists");
	spyOn(objectStore, "getAll").mockImplementation(async () => []);
	spyOn(objectStore, "set").mockImplementation(async () => {});
	const getObjectStore = database.getObjectStore.bind(database);
	spyOn(database, "getObjectStore").mockImplementation((name: StoreName) =>
		name === "playlists" ? objectStore : getObjectStore(name),
	);
	const injected = createStores(database);
	spyOn(injected.versionsStore, "initialize").mockImplementation(async () => {
		throw new Error("Catalog offline");
	});
	const catalog = injected.initialize();
	await injected.playlistStore.initialize();
	await assert.rejects(catalog, /Catalog offline/);
	const playlist = await injected.playlistStore.create({
		title: "Offline playlist",
	});
	function PlaylistProbe() {
		const { playlistStore } = useStores();
		assert.equal(playlistStore, injected.playlistStore);
		return <span>{playlistStore.get({ playlistId: playlist.id })?.title}</span>;
	}
	assert.equal(
		renderToStaticMarkup(
			<StoresProvider stores={injected}>
				<PlaylistProbe />
			</StoresProvider>,
		),
		"<span>Offline playlist</span>",
	);
});
