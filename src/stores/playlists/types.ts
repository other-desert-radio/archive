export type PlaylistEntry = Readonly<{
	showId: number;
	/** UTC ISO timestamp. */
	addedAt: string;
	/** UTC ISO timestamp of the last entry change. */
	updatedAt: string;
	note?: string;
}>;

/** Edit through PlaylistStore so changes are persisted and subscribers notified. */
export type Playlist = Readonly<{
	id: string;
	/** Distinguishes the protected Liked Shows playlist from user playlists. */
	type: "user" | "liked";
	title: string;
	/** UTC ISO timestamp. */
	createdAt: string;
	/** UTC ISO timestamp. */
	updatedAt: string;
	shows: readonly PlaylistEntry[];
}>;
