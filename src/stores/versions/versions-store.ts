import { isMatching, P } from "ts-pattern";
import type { Database } from "../../database/types";
import { IsoDatePattern } from "../../utils/patterns";

const VersionPattern = { id: P.number, updatedAt: IsoDatePattern };
const VersionsPattern = {
	shows: VersionPattern,
	djs: VersionPattern,
	tags: VersionPattern,
};
type DataVersions = P.infer<typeof VersionsPattern>;
export type DatasetName = keyof DataVersions;

/** Shares published revisions and locally committed revisions without advancing the local cache. */
export class VersionsStore {
	private published: DataVersions | undefined;
	private cached = new Map<string, number>();
	private initialization: Promise<void> | undefined;
	private readonly metadata;

	constructor(database: Database) {
		this.metadata = database.getObjectStore("metadata");
	}

	/** Called from browser initialization; concurrent calls share a load, and failures allow retry. */
	initialize(base = import.meta.env.BASE_URL): Promise<void> {
		this.initialization ??= this.load(base).catch((error: unknown) => {
			this.initialization = undefined;
			console.error(
				"[VersionsStore] initialization failed; retry available",
				error,
			);
			throw error;
		});
		return this.initialization;
	}

	invalidatePublished(): void {
		this.initialization = undefined;
		this.published = undefined;
	}

	private async load(base: string): Promise<void> {
		const url = `${base.replace(/\/?$/, "/")}resources/data_versions.json`;
		const response = await fetch(url, { cache: "no-cache" });
		if (!response.ok) {
			throw new Error(`Cannot fetch data versions: ${response.status}`);
		}
		const data: unknown = await response.json();
		if (!isMatching(VersionsPattern, data)) {
			throw new Error("Data versions have an unexpected format");
		}
		await this.refreshCached();
		this.published = data;
		console.log("[VersionsStore] published revisions loaded", data);
	}

	getPublished(name: DatasetName): number | undefined {
		return this.published?.[name].id;
	}

	getCached(name: DatasetName): number | undefined {
		return this.cached.get(name);
	}

	/** Reload after a dataset and its revision commit together; never persist the remote manifest here. */
	async refreshCached(): Promise<void> {
		console.log("[VersionsStore] reading committed revisions from IndexedDB");
		const records = await this.metadata.getAll();
		this.cached = new Map(records.map(({ key, revision }) => [key, revision]));
		console.log(
			"[VersionsStore] cached revisions loaded",
			Object.fromEntries(this.cached),
		);
	}
}
