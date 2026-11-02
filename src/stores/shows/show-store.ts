import type { Database, DBStore } from "../../database/types";
import type { Show } from "../../utils/fetch-shows";
import type { VersionsStore } from "../versions/versions-store";

type ShowsExport = {
	version: number;
	updatedAt: string;
	data: Show[];
};

export class ShowStore {
	constructor(
		database: Database,
		private readonly versionsStore: VersionsStore,
	) {
		this.showObjectStore = database.getObjectStore("shows");
	}

	initialize(): void {
		console.log(
			`[ShowStore] cached revision: ${this.versionsStore.getCached("shows") ?? "none"}`,
		);
		console.log(
			`[ShowStore] show data_version: ${this.versionsStore.getPublished("shows")}`,
		);

		// Compare revisions and refresh the catalog before loading shows into memory.
	}

	get(id: number): Promise<Show | undefined> {
		return this.showObjectStore.get(id);
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

	private showObjectStore: DBStore<Show, number>;
}
