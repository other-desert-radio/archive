import type { Database } from "../../database/types";
import type { VersionsStore } from "../versions/versions-store";
import type { ShowDetail, ShowDetailsExport } from "./types";

// Composition will supply the shared database and manifest store without blocking browsing.
export class ShowDetailStore {
	constructor(_database: Database, _versionsStore: VersionsStore) {
		throw new Error("Not implemented");
	}

	// Read cache first, then check the manifest and atomically commit any replacement.
	initialize(_base?: string): Promise<void> {
		throw new Error("Not implemented");
	}

	get(_id: number): ShowDetail | undefined {
		throw new Error("Not implemented");
	}

	subscribe = (_notify: () => void): (() => void) => {
		throw new Error("Not implemented");
	};

	fetchDetails(_base?: string): Promise<ShowDetailsExport> {
		throw new Error("Not implemented");
	}

	// A mismatch refreshes the manifest and retries once without discarding cached records.
	fetchUpdatedDetails(_base?: string): Promise<ShowDetailsExport | undefined> {
		throw new Error("Not implemented");
	}

	// Commit records and their revision together before publishing replacement memory.
	saveDetails(_exported: ShowDetailsExport): Promise<void> {
		throw new Error("Not implemented");
	}
}
