import type { Database, DBStore, StoreSchema } from "../../database/types";
import type { Show } from "../../utils/fetch-shows";

type DataVersionEntry = {
	id: number;
	updatedAt: string;
};
type DataVersions = {
	shows: DataVersionEntry;
	djs: DataVersionEntry;
	tags: DataVersionEntry;
};
export class ShowStore {
	constructor(database: Database) {
		this.showObjectStore = database.getObjectStore("shows");
	}

	async initialize(
		cachedMetadata: StoreSchema["metadata"]["value"] | undefined,
	) {
		console.log(
			`[ShowStore] cached revision: ${cachedMetadata?.revision ?? "none"}`,
		);

		// 2. compare cache version to data_versions.json
		const { shows } = await this.fetchVersions();
		console.log(`[ShowStore] show data_version: ${shows.id}`);

		// 3. if out of date, print "updating" and update the database -- mark start and end time

		// 4. load shows into memory
	}

	async fetchVersions(base = import.meta.env.BASE_URL): Promise<DataVersions> {
		const response = await fetch(
			`${base.replace(/\/?$/, "/")}resources/data_versions.json`,
			{ cache: "no-cache" },
		);
		if (!response.ok) {
			throw new Error(`Cannot fetch data versions: ${response.status}`);
		}
		return (await response.json()) as DataVersions; // validated by the server before generation
	}

	get(id: number): Promise<Show | undefined> {
		return this.showObjectStore.get(id);
	}

	private showObjectStore: DBStore<Show, number>;
}
