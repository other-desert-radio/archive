type Playlist = {
	id: uuid; // UUID so if we upload these to a server, the ID are unique
	title: string;
	createdAt: timestamp;
	lastUpdated: timestamp;
	shows: Array<{
		id: number; // show ID
		addedAt: timestamp;
		note: string | undefined; // short note users can add
	}>;
};
