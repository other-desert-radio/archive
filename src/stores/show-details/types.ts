export type ShowDetailEntry = (
	| { artist: string; song: string }
	| { chapter: string }
) & {
	start_time?: number;
};

export type ShowDetail = {
	id: number;
	description?: string;
	tracklist?: ShowDetailEntry[];
};

export type ShowDetailsExport = {
	version: number;
	updatedAt: string;
	data: ShowDetail[];
};
