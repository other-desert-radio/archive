import type { Playlist, PlaylistSave } from "../../../stores/playlists/types";

// Index once per playlist snapshot so cards receive only their saves without rescanning every playlist.
// Playlists                         Saves by show ID
// A: [show 1, show 2]  -->           1: [{ playlistId: A, title }]
// B: [show 2]                       2: [{ playlistId: A, title },
//                                       { playlistId: B, title }]
export function getPlaylistSavesByShowId(playlists: readonly Playlist[]) {
	const savesByShowId = new Map<number, PlaylistSave[]>();
	for (const playlist of playlists) {
		for (const entry of playlist.shows) {
			let saves = savesByShowId.get(entry.showId);
			if (!saves) {
				saves = [];
				savesByShowId.set(entry.showId, saves);
			}
			saves.push({
				playlistId: playlist.id,
				title: playlist.title,
			});
		}
	}
	return savesByShowId;
}
