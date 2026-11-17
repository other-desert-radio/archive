import { isMatching } from "ts-pattern";
import type { Database, TransactionOperation } from "../../database/types";
import type { VersionsStore } from "../versions/versions-store";
import {
	type ShowDetail,
	type ShowDetailsExport,
	ShowDetailsExportPattern,
} from "./types";

// Composition will supply the shared database and manifest store without blocking browsing.
export class ShowDetailStore {
	private details = new Map<number, ShowDetail>();
	private initialization: Promise<void> | undefined;
	private listeners = new Set<() => void>();
	private readonly objectStore;

	constructor(
		private readonly database: Database,
		private readonly versionsStore: VersionsStore,
	) {
		this.objectStore = database.getObjectStore("show_details");
	}

	// Read cache first, then check the manifest and atomically commit any replacement.
	initialize(base = import.meta.env.BASE_URL): Promise<void> {
		this.initialization ??= this.load(base).catch((error: unknown) => {
			this.initialization = undefined;
			throw error;
		});
		return this.initialization;
	}

	private async load(base: string): Promise<void> {
		const cached = await this.objectStore.getAll();
		this.replace(cached);
		await this.versionsStore.initialize(base);
		const updated = await this.fetchUpdatedDetails(base);
		if (updated) {
			await this.saveDetails(updated);
		}
	}

	get(id: number): ShowDetail | undefined {
		return this.details.get(id);
	}

	subscribe = (notify: () => void): (() => void) => {
		this.listeners.add(notify);
		return () => {
			this.listeners.delete(notify);
		};
	};

	private replace(details: ShowDetail[]): void {
		this.details = new Map(details.map((detail) => [detail.id, detail]));
		for (const notify of this.listeners) {
			notify();
		}
	}

	async fetchDetails(
		base = import.meta.env.BASE_URL,
	): Promise<ShowDetailsExport> {
		const response = await fetch(
			`${base.replace(/\/?$/, "/")}resources/show_details.json`,
			{ cache: "no-cache" },
		);
		if (!response.ok) {
			throw new Error(`Cannot fetch show details: ${response.status}`);
		}
		const exported: unknown = await response.json();
		if (!isMatching(ShowDetailsExportPattern, exported)) {
			throw new Error("Show details have an unexpected format");
		}
		return exported;
	}

	// A mismatch refreshes the manifest and retries once without discarding cached records.
	async fetchUpdatedDetails(
		base = import.meta.env.BASE_URL,
	): Promise<ShowDetailsExport | undefined> {
		for (const attempt of [0, 1]) {
			const published = this.versionsStore.getPublished("show_details");
			if (published === undefined) {
				throw new Error(
					"Initialize versions before checking for details updates",
				);
			}
			if (published === this.versionsStore.getCached("show_details")) {
				return undefined;
			}
			const exported = await this.fetchDetails(base);
			if (exported.version === published) {
				return exported;
			}
			if (attempt === 1) {
				throw new Error(
					`Show details revision mismatch: expected ${published}, received ${exported.version}`,
				);
			}
			this.versionsStore.invalidatePublished();
			await this.versionsStore.initialize(base);
		}
		return undefined;
	}

	// Commit records and their revision together before publishing replacement memory.
	async saveDetails(exported: ShowDetailsExport): Promise<void> {
		await this.database.transaction([
			{ store: "show_details", action: "clear" },
			...exported.data.map<TransactionOperation>((detail) => ({
				store: "show_details",
				action: "set",
				value: detail,
			})),
			{
				store: "metadata",
				action: "set",
				value: { key: "show_details", revision: exported.version },
			},
		]);
		await this.versionsStore.refreshCached();
		this.replace(exported.data);
	}
}
