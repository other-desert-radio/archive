import type { ReactElement, Ref } from "react";
import type { Playlist } from "../../stores";

type NewPlaylistModalProps = {
	ref: Ref<HTMLDialogElement>;
	onCreated?: (playlist: Playlist) => void;
};

// Callers open this sibling dialog through ref; creation persists before onCreated.
export default function NewPlaylistModal(
	_props: NewPlaylistModalProps,
): ReactElement {
	throw new Error("Not implemented");
}
