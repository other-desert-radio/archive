/** Saved progress and listening sessions for one show; stored by showId. */
export type PlaybackRecord = {
	/** IndexedDB key identifying the show. */
	showId: number;
	/** Unfinished playback, including a paused show; false after playback ends. */
	inProgress: boolean;
	/** Latest known playback position in seconds, used for resume. */
	positionInSeconds: number;
	/** Separate sessions, including those too short to count as listens. */
	history: PlaybackSession[];
};

/** One session; pauses and internal archive navigation preserve it. */
export type PlaybackSession = {
	/** Time playback first advances, as Unix milliseconds. */
	startedAt: number;
	/** Latest checkpoint time as Unix milliseconds; closes sessions after reload. */
	updatedAt: number;
	/** Session end time as Unix milliseconds; absent while open. */
	endedAt?: number;
	/** Actual position where the session began, in seconds. */
	startPosition: number;
	/** Latest position in seconds; seeking can move it backward or forward. */
	endPosition: number;
	/** Playback seconds excluding pauses and buffering; > 10 counts as a listen. */
	playedSeconds: number;
};
