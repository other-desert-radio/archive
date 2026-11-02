import type { Database, DBStore } from "../../database/types";
import type { Show } from "../../utils/fetch-shows";
import type { VersionsStore } from "../versions/versions-store";

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

	private showObjectStore: DBStore<Show, number>;
}
