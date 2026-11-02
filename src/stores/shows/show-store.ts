import type {
	Database,
	DBStore,
	TransactionOperation,
} from "../../database/types";
import type { Show } from "../../utils/fetch-shows";
import type { VersionsStore } from "../versions/versions-store";

type ShowsExport = {
	version: number;
	updatedAt: string;
	data: Show[];
};

export class ShowStore {
	private shows: Map<number, Show> = new Map();
	private showObjectStore: DBStore<Show, number>;

	constructor(
		private readonly database: Database,
		private readonly versionsStore: VersionsStore,
	) {
		this.showObjectStore = database.getObjectStore("shows");
	}

	async initialize(base = import.meta.env.BASE_URL): Promise<void> {
		const cached = await this.showObjectStore.getAll();
		this.shows = new Map(cached.map((show) => [show.id, show]));
		console.log(
			`[ShowStore] cached revision: ${this.versionsStore.getCached("shows") ?? "none"}`,
		);
		console.log(
			`[ShowStore] show data_version: ${this.versionsStore.getPublished("shows")}`,
		);

		const updated = await this.fetchUpdatedShows(base);
		if (updated) {
			await this.saveShows(updated);
			this.shows = new Map(updated.data.map((show) => [show.id, show]));
		}
		console.log(`[ShowStore] loaded ${this.shows.size} shows into memory`);
	}

	get(id: number): Show | undefined {
		return this.shows.get(id);
	}

	getAll(): Show[] {
		return [...this.shows.values()];
	}

	async fetchShows(base = import.meta.env.BASE_URL): Promise<ShowsExport> {
		const response = await fetch(
			`${base.replace(/\/?$/, "/")}resources/shows.json`,
			{ cache: "no-cache" },
		);
		if (!response.ok) {
			throw new Error(`Cannot fetch shows: ${response.status}`);
		}
		// Trust the first-party export; publish-time structure validation is planned.
		return (await response.json()) as ShowsExport;
	}

	async fetchUpdatedShows(
		base = import.meta.env.BASE_URL,
	): Promise<ShowsExport | undefined> {
		const published = this.versionsStore.getPublished("shows");
		if (published === undefined) {
			throw new Error("Initialize versions before checking for show updates");
		}
		if (published === this.versionsStore.getCached("shows")) {
			return undefined;
		}
		const exported = await this.fetchShows(base);
		if (exported.version !== published) {
			throw new Error(
				`Show revision mismatch: expected ${published}, received ${exported.version}`,
			);
		}
		return exported;
	}

	async saveShows(exported: ShowsExport): Promise<void> {
		const startedAt = Date.now();
		console.log(`[ShowStore] saving revision ${exported.version}`);
		// TODO: investigate incremental upserts and deletions if mobile import timings justify them.
		await this.database.transaction([
			{ store: "shows", action: "clear" },
			...exported.data.map<TransactionOperation>((show) => ({
				store: "shows",
				action: "set",
				value: show,
			})),
			{
				store: "metadata",
				action: "set",
				value: { key: "shows", revision: exported.version },
			},
		]);
		await this.versionsStore.refreshCached();
		console.log(
			`[ShowStore] saved revision ${exported.version} in ${Date.now() - startedAt}ms`,
		);
	}
}
