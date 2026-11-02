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

	async function execute<T>(
		names: string[],
		mode: IDBTransactionMode,
		queue: (tx: IDBTransaction) => () => T,
	): Promise<T> {
		const db = await openDatabase();
		return new Promise<T>((resolve, reject) => {
			const tx = db.transaction(names, mode);
			let result: () => T;
			let failure: unknown;
			tx.oncomplete = () => resolve(result());
			tx.onabort = () => {
				reject(failure ?? tx.error ?? new Error("Archive transaction aborted"));
			};
			try {
				result = queue(tx);
			} catch (error) {
				failure = error;
				tx.abort();
			}
		});
	}

	return {
		getObjectStore(name: StoreName): DBStore<Show, number> {
			return {
				get(key: number): Promise<Show | undefined> {
					return execute([name], "readonly", (tx) => {
						const request: IDBRequest<Show | undefined> = tx
							.objectStore(name)
							.get(key);
						return () => request.result;
					});
				},
				getAll(): Promise<Show[]> {
					return execute([name], "readonly", (tx) => {
						const request: IDBRequest<Show[]> = tx.objectStore(name).getAll();
						return () => request.result;
					});
				},
				set(value: Show): Promise<void> {
					return execute([name], "readwrite", (tx) => {
						tx.objectStore(name).put(value);
						return () => undefined;
					});
				},
				delete(key: number): Promise<void> {
					return execute([name], "readwrite", (tx) => {
						tx.objectStore(name).delete(key);
						return () => undefined;
					});
				},
			};
		},
		async transaction(operations: TransactionOperation[]): Promise<void> {
			if (operations.length === 0) {
				return;
			}
			const names = [...new Set(operations.map(({ store }) => store))];
			await execute(names, "readwrite", (tx) => {
				for (const operation of operations) {
					const store = tx.objectStore(operation.store);
					switch (operation.action) {
						case "clear":
							store.clear();
							break;
						case "set":
							store.put(operation.value);
							break;
					}
				}
				return () => undefined;
			});
		},
	};
}
