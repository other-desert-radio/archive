export type PlaylistEntry = Readonly<{
	showId: number;
	/** UTC ISO timestamp. */
	addedAt: string;
	note?: string;
}>;

/** Edit through PlaylistStore so changes are persisted and subscribers notified. */
export type Playlist = Readonly<{
	id: string;
	title: string;
	/** UTC ISO timestamp. */
	createdAt: string;
	/** UTC ISO timestamp. */
	updatedAt: string;
	shows: readonly PlaylistEntry[];
}>;
