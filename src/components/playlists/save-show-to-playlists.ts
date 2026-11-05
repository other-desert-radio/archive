import type { PlaylistStore } from "../../stores/playlists/playlist-store";

export async function saveShowToPlaylists({
	playlistStore,
	showId,
	playlistIds,
	note,
}: {
	playlistStore: PlaylistStore;
	showId: number;
	playlistIds: readonly string[];
	note: string | undefined;
}): Promise<void> {
	await playlistStore.initialize();
	for (const playlist of playlistStore.getAll()) {
		const containsShow = playlist.shows.some(
			(entry) => entry.showId === showId,
		);
		if (playlistIds.includes(playlist.id)) {
			if (!containsShow) {
				await playlistStore.addShow({ playlistId: playlist.id, showId });
			}
			if (note !== undefined) {
				await playlistStore.setNote({
					playlistId: playlist.id,
					showId,
					note: note === "" ? undefined : note,
				});
			}
		} else if (containsShow) {
			await playlistStore.removeShow({ playlistId: playlist.id, showId });
		}
	}
}
