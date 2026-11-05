export type PlaylistEntry = {
	showId: number;
	/** UTC ISO timestamp. */
	addedAt: string;
	note?: string;
};

export type Playlist = {
	id: string;
	title: string;
	/** UTC ISO timestamp. */
	createdAt: string;
	/** UTC ISO timestamp. */
	updatedAt: string;
	shows: PlaylistEntry[];
};
