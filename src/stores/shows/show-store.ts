import type { Database, DBStore } from "../../database/types";
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
		this.initalize();
	}

	private async initalize() {
		// 1. read from the database, see if cache exists

		// 2. compare cache version to data_versions.json
		const { shows } = await this.fetchVersions();
		console.log(`[ShowStore] show data_version: ${shows.id}`);

		// 3. if out of date, print "updating" and update the database -- mark start and end time
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

	get(id: number) {
		throw new Error(`${id} -- not implemented`);
	}

	private showObjectStore: DBStore<Show, number>;
}
