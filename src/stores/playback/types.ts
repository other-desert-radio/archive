/** Saved progress and listen history for one show, keyed by showId. */
export type PlaybackRecord = {
	/** IndexedDB key identifying the show. */
	showId: number;
	/** True while the latest listen is unfinished, including across reloads. */
	inProgress: boolean;
	/** Latest known position in seconds, used for resume. */
	positionInSeconds: number;
	/** Completed listens and, if present, the latest unfinished listen. */
	history: PlaybackSession[];
};

/** One listen attempt, preserved across interruptions until completion. */
export type PlaybackSession = {
	/** First confirmed playback progress, as Unix milliseconds. */
	startedAt: number;
	/** Latest progress checkpoint or completion time, as Unix milliseconds. */
	updatedAt: number;
	/** Unix milliseconds when playback reaches the end; absent while unfinished. */
	completedAt?: number;
	/** Actual reported position where this listen began, in seconds. */
	startPosition: number;
	/** Latest reported position during this listen, in seconds. */
	endPosition: number;
};
