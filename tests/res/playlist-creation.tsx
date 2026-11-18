import { useRef } from "react";
import { createRoot } from "react-dom/client";
import "../../src/styles/styles.css";
import Miniplayer from "../../src/components/miniplayer/Miniplayer";
import NewPlaylistModal from "../../src/components/playlists/NewPlaylistModal";
import SaveToPlaylist from "../../src/components/playlists/SaveToPlaylist";
import { createStores, StoresProvider } from "../../src/stores";
import shows from "./shows.json";

const stores = createStores();
stores.initialize = async () => {};
const originalCreate = stores.playlistStore.create.bind(stores.playlistStore);
const controls = {
	stores,
	resumeLoading: () => {},
	fail: false,
	pause: false,
	resume: () => {},
	createCalls: 0,
};
const playlistLoad = new URLSearchParams(location.search).get("playlistLoad");
if (playlistLoad) {
	const initialize = stores.playlistStore.initialize.bind(stores.playlistStore);
	const gate = new Promise<void>((resolve) => {
		controls.resumeLoading = resolve;
	});
	stores.playlistStore.initialize = () =>
		gate.then(() => {
			if (playlistLoad === "error") {
				throw new Error("Test playlist loading failure");
			}
			return initialize();
		});
}
stores.playlistStore.create = async (input) => {
	controls.createCalls++;
	if (controls.pause) {
		await new Promise<void>((resolve) => {
			controls.resume = resolve;
		});
	}
	if (controls.fail) {
		throw new Error("Test persistence failure");
	}
	return originalCreate(input);
};
Object.assign(window, { playlistFixture: controls });

function Fixture() {
	const modal = useRef<HTMLDialogElement>(null);
	return (
		<StoresProvider stores={stores}>
			<SaveToPlaylist showId={42} />
			<button
				type="button"
				aria-label="Create standalone playlist"
				onClick={() => modal.current?.showModal()}
			>
				New Playlist
			</button>
			<NewPlaylistModal ref={modal} />
			<button
				type="button"
				aria-label="Select player show"
				onClick={() => {
					const show = shows.data[0];
					if (show) {
						stores.audioStore.select({
							show,
							source: { kind: "mixcloud", cloudcastKey: "/dj/show/" },
						});
					}
				}}
			>
				Select show
			</button>
			<Miniplayer base="" />
		</StoresProvider>
	);
}

const root = document.getElementById("root");
if (!root) {
	throw new Error("Missing fixture root");
}
createRoot(root).render(<Fixture />);
