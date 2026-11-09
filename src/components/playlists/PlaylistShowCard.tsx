import type { ReactElement } from "react";
import type { PlaybackRecord } from "../../stores/playback/types";
import type { PlaylistEntry } from "../../stores/playlists/types";
import type { Show } from "../../utils/fetch-shows";
import type { TagMap } from "../../utils/fetch-tags";

type Props = {
	show: Show;
	entry: PlaylistEntry;
	tags: TagMap;
	record?: Pick<PlaybackRecord, "positionInSeconds" | "inProgress"> | undefined;
};

/** Playlist-only presentation; reuse PlayableShowArtwork and TagContainer when implemented. */
export default function PlaylistShowCard(_props: Props): ReactElement {
	throw new Error("Not implemented");
}
