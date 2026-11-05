import type { Playlist } from "../stores/playlists/types";
import type {
	Database,
	DBStore,
	StoreName,
	StoreSchema,
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
			const request = indexedDB.open("odr-archive", 4);
			let abandoned = false;
			const timeout = setTimeout(() => {
				fail(new Error("Opening archive storage timed out"));
			}, 5000);
			function fail(error: Error) {
				abandoned = true;
				clearTimeout(timeout);
				reject(error);
			}
			/**
			 * Migration/initialization code
			 */
			request.onupgradeneeded = () => {
				if (abandoned) {
					request.transaction?.abort();
					return;
				}
				const db = request.result;
				if (!db.objectStoreNames.contains("playlists")) {
					db.createObjectStore("playlists", { keyPath: "id" });
				}
				if (!db.objectStoreNames.contains("playback")) {
					db.createObjectStore("playback", { keyPath: "showId" });
				}
				if (!db.objectStoreNames.contains("shows")) {
					console.log("[IndexedDB] Creating shows object store");
					db.createObjectStore("shows", { keyPath: "id" });
				}
				if (!db.objectStoreNames.contains("metadata")) {
					console.log("[IndexedDB] Creating metadata object store");
					db.createObjectStore("metadata", { keyPath: "key" });
				}
				if (!db.objectStoreNames.contains("tags")) {
					console.log("[IndexedDB] Creating tags object store");
					db.createObjectStore("tags", { keyPath: "id" });
				}
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
		ensureLikedPlaylist(fallback: Playlist & { type: "liked" }): Promise<void> {
			return execute(["playlists"], "readwrite", (tx) => {
				const store = tx.objectStore("playlists");
				const request: IDBRequest<Playlist[]> = store.getAll();
				request.onsuccess = () => {
					if (!request.result.some((playlist) => playlist.type === "liked")) {
						store.add(fallback);
					}
				};
				return () => undefined;
			});
		},
		getObjectStore<N extends StoreName>(
			name: N,
		): DBStore<StoreSchema[N]["value"], StoreSchema[N]["key"]> {
			type Value = StoreSchema[N]["value"];
			type Key = StoreSchema[N]["key"];
			return {
				get(key: Key): Promise<Value | undefined> {
					return execute([name], "readonly", (tx) => {
						const request: IDBRequest<Value | undefined> = tx
							.objectStore(name)
							.get(key);
						return () => request.result;
					});
				},
				getAll(): Promise<Value[]> {
					return execute([name], "readonly", (tx) => {
						const request: IDBRequest<Value[]> = tx.objectStore(name).getAll();
						return () => request.result;
					});
				},
				set(value: Value): Promise<void> {
					return execute([name], "readwrite", (tx) => {
						tx.objectStore(name).put(value);
						return () => undefined;
					});
				},
				delete(key: Key): Promise<void> {
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
						case "delete":
							store.delete(operation.key);
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
