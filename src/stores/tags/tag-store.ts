import type {
	Database,
	DBStore,
	TransactionOperation,
} from "../../database/types";
import type { Tag } from "../../utils/fetch-tags";
import type { VersionsStore } from "../versions/versions-store";

type TagsExport = {
	version: number;
	updatedAt: string;
	data: Tag[];
};

export class TagStore {
	private tags: Map<number, Tag> = new Map();
	private tagObjectStore: DBStore<Tag, number>;

	constructor(
		private readonly database: Database,
		private readonly versionsStore: VersionsStore,
	) {
		this.tagObjectStore = database.getObjectStore("tags");
	}

	async initialize(base = import.meta.env.BASE_URL): Promise<void> {
		const cached = await this.tagObjectStore.getAll();
		this.tags = new Map(cached.map((tag) => [tag.id, tag]));
		console.log(
			`[TagStore] cached revision: ${this.versionsStore.getCached("tags") ?? "none"}`,
		);
		console.log(
			`[TagStore] tag data_version: ${this.versionsStore.getPublished("tags")}`,
		);

		const updated = await this.fetchUpdatedTags(base);
		if (updated) {
			await this.saveTags(updated);
			this.tags = new Map(updated.data.map((tag) => [tag.id, tag]));
		}
		console.log(`[TagStore] loaded ${this.tags.size} tags into memory`);
	}

	get(id: number): Tag | undefined {
		return this.tags.get(id);
	}

	getAll(): Tag[] {
		return [...this.tags.values()];
	}

	async fetchTags(base = import.meta.env.BASE_URL): Promise<TagsExport> {
		const response = await fetch(
			`${base.replace(/\/?$/, "/")}resources/tags.json`,
			{ cache: "no-cache" },
		);
		if (!response.ok) {
			throw new Error(`Cannot fetch tags: ${response.status}`);
		}
		// CI validates export structure before publishing, so browser loads skip record validation.
		return (await response.json()) as TagsExport;
	}

	async fetchUpdatedTags(
		base = import.meta.env.BASE_URL,
	): Promise<TagsExport | undefined> {
		const published = this.versionsStore.getPublished("tags");
		if (published === undefined) {
			throw new Error("Initialize versions before checking for tag updates");
		}
		if (published === this.versionsStore.getCached("tags")) {
			return undefined;
		}
		console.log(
			`%c[TagStore] Downloading tags for IndexedDB — revision ${published}`,
			"background: #173b75; color: #fff; font-weight: bold; padding: 4px 8px;",
		);
		const exported = await this.fetchTags(base);
		if (exported.version !== published) {
			throw new Error(
				`Tag revision mismatch: expected ${published}, received ${exported.version}`,
			);
		}
		return exported;
	}

	async saveTags(exported: TagsExport): Promise<void> {
		const startedAt = Date.now();
		console.log(
			`%c[TagStore] Saving ${exported.data.length} tags to IndexedDB — revision ${exported.version}`,
			"background: #754600; color: #fff; font-weight: bold; padding: 4px 8px;",
		);
		await this.database.transaction([
			{ store: "tags", action: "clear" },
			...exported.data.map<TransactionOperation>((tag) => ({
				store: "tags",
				action: "set",
				value: tag,
			})),
			{
				store: "metadata",
				action: "set",
				value: { key: "tags", revision: exported.version },
			},
		]);
		await this.versionsStore.refreshCached();
		console.log(
			`%c[TagStore] Saved ${exported.data.length} tags to IndexedDB — revision ${exported.version} in ${Date.now() - startedAt}ms`,
			"background: #14532d; color: #fff; font-weight: bold; padding: 4px 8px;",
		);
	}
}
