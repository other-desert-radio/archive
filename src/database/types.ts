import type { Show } from "../utils/fetch-shows";

export type StoreName = "shows";

export type Database = {
	getObjectStore(name: StoreName): DBStore<Show, number>;
};

export type DBStore<T, K> = {
	get(key: K): Promise<T | undefined>;
	getAll(): Promise<T[]>;
	set(value: T): Promise<void>;
	delete(key: K): Promise<void>;
};
