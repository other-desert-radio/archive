import type { Database } from "../database/types";

export type SearchCategory = "shows" | "explore" | "djs";
export type SearchEntry = { query: string; date: number };

export class SearchHistoryStore {
	private entries: Record<SearchCategory, readonly SearchEntry[]> = {
		shows: [],
		explore: [],
		djs: [],
	};
	private loading = new Map<SearchCategory, Promise<void>>();
	private listeners = new Set<() => void>();
	private queue: Promise<void> = Promise.resolve();

	constructor(private readonly database: Database) {}

	getSnapshot(category: SearchCategory): readonly SearchEntry[] {
		return this.entries[category];
	}

	subscribe = (listener: () => void): (() => void) => {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	};

	private publish(category: SearchCategory, entries: readonly SearchEntry[]) {
		this.entries[category] = [...entries].sort((a, b) => b.date - a.date);
		for (const listener of this.listeners) {
			listener();
		}
	}

	initialize(category: SearchCategory): Promise<void> {
		let loading = this.loading.get(category);
		if (!loading) {
			loading = this.database
				.getObjectStore(`search_${category}`)
				.getAll()
				.then((entries) => {
					this.publish(category, entries);
				})
				.catch((error: unknown) => {
					this.loading.delete(category);
					throw error;
				});
			this.loading.set(category, loading);
		}
		return loading;
	}

	save(category: SearchCategory, value: string): Promise<void> {
		const query = value.trim();
		if (!query) {
			return Promise.resolve();
		}
		const entry = { query, date: Date.now() };
		return this.enqueue(async () => {
			await this.initialize(category);
			await this.database.getObjectStore(`search_${category}`).set(entry);
			this.publish(category, [
				entry,
				...this.entries[category].filter((item) => item.query !== query),
			]);
		});
	}

	remove(category: SearchCategory, query: string): Promise<void> {
		return this.enqueue(async () => {
			await this.initialize(category);
			await this.database.getObjectStore(`search_${category}`).delete(query);
			this.publish(
				category,
				this.entries[category].filter((item) => item.query !== query),
			);
		});
	}

	private enqueue(operation: () => Promise<void>): Promise<void> {
		const result = this.queue.then(operation);
		this.queue = result.catch(() => {});
		return result;
	}
}
