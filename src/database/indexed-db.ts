import type { Show } from "../utils/fetch-shows";
import type {
	Database,
	DBStore,
	StoreName,
	TransactionOperation,
} from "./types";

export function createIndexedDB(): Database {
	// Open lazily so creating stores does not access browser APIs during SSR.
	async function openDatabase(): Promise<IDBDatabase> {
		throw new Error("Not implemented");
	}

	return {
		getObjectStore(_name: StoreName): DBStore<Show, number> {
			return {
				async get(_key: number): Promise<Show | undefined> {
					await openDatabase();
					throw new Error("Not implemented");
				},
				async getAll(): Promise<Show[]> {
					await openDatabase();
					throw new Error("Not implemented");
				},
				async set(_value: Show): Promise<void> {
					await openDatabase();
					throw new Error("Not implemented");
				},
				async delete(_key: number): Promise<void> {
					await openDatabase();
					throw new Error("Not implemented");
				},
			};
		},
		async transaction(_operations: TransactionOperation[]): Promise<void> {
			await openDatabase();
			// Queue the full batch synchronously; resolve only on transaction commit.
			throw new Error("Not implemented");
		},
	};
}
