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
	constructor(
		private readonly database: Database,
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

	private showObjectStore: DBStore<Show, number>;
}
