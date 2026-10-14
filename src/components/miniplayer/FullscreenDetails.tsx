import type { ReactElement } from "react";
import type { Show } from "../../utils/fetch-shows";
import type { TagMap } from "../../utils/fetch-tags";

type ShowProps = {
	show: Show;
	base: string;
};

type TagsProps = ShowProps & {
	tags: TagMap;
};

// Miniplayer will compose these sections around its existing widget-slot.
// Keep each section separate so CSS can reorder DJs without moving the iframe.
export function FullscreenArtwork(_props: ShowProps): ReactElement {
	throw new Error("Not implemented");
}

export function FullscreenTitle(_props: ShowProps): ReactElement {
	throw new Error("Not implemented");
}

// The caller supplies the catalog; this section resolves the show's tag IDs.
export function FullscreenTags(_props: TagsProps): ReactElement {
	throw new Error("Not implemented");
}

// Render all DJ links/portraits; shows without DJs have no DJ section.
export function FullscreenDJs(_props: ShowProps): ReactElement | null {
	throw new Error("Not implemented");
}

// Presentational only: favorites behavior is outside this task's scope.
export function FullscreenHeart(): ReactElement {
	throw new Error("Not implemented");
}
