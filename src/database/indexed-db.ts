import type { Show } from "../utils/fetch-shows";
import type {
	Database,
	DBStore,
	StoreName,
	TransactionOperation,
} from "./types";

export function createIndexedDB(): Database {
	let connection: Promise<IDBDatabase> | undefined;

	// Open lazily so creating stores does not access browser APIs during SSR.
	async function openDatabase(): Promise<IDBDatabase> {
		if (connection) {
			return connection;
		}
		connection = new Promise<IDBDatabase>((resolve, reject) => {
			const request = indexedDB.open("odr-archive", 1);
			let abandoned = false;
			const timeout = setTimeout(() => {
				fail(new Error("Opening archive storage timed out"));
			}, 5000);
			function fail(error: Error) {
				abandoned = true;
				clearTimeout(timeout);
				reject(error);
			}
			request.onupgradeneeded = () => {
				if (abandoned) {
					request.transaction?.abort();
					return;
				}
				const db = request.result;
				db.createObjectStore("shows", { keyPath: "id" });
				db.createObjectStore("metadata", { keyPath: "key" });
			};
			request.onerror = () => {
				fail(request.error ?? new Error("Cannot open archive storage"));
			};
			request.onblocked = () => {
				fail(
					new Error(
						"Archive storage upgrade blocked; close other archive tabs",
					),
				);
			};
			request.onsuccess = () => {
				clearTimeout(timeout);
				const db = request.result;
				if (abandoned) {
					db.close();
					return;
				}
				db.onversionchange = () => {
					db.close();
					connection = undefined;
				};
				db.onclose = () => {
					connection = undefined;
				};
				resolve(db);
			};
		}).catch((error: unknown) => {
			connection = undefined;
			throw error;
		});
		return connection;
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
