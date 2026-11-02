import type { Show } from "../utils/fetch-shows";

export type StoreName = "shows";

export type TransactionOperation =
	| { store: "shows"; action: "clear" }
	| { store: "shows"; action: "set"; value: Show }
	| {
			store: "metadata";
			action: "set";
			value: { key: "shows"; revision: number };
	  };

export type Database = {
	getObjectStore(name: StoreName): DBStore<Show, number>;
	// Commit the batch in order, or roll it all back; resolve only after commit.
	transaction(operations: TransactionOperation[]): Promise<void>;
};

export type DBStore<T, K> = {
	get(key: K): Promise<T | undefined>;
	getAll(): Promise<T[]>;
	set(value: T): Promise<void>;
	delete(key: K): Promise<void>;
};
