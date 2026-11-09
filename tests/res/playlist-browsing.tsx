import { createRoot } from "react-dom/client";
import HistoryPane from "../../src/components/history/HistoryPane";
import PlaylistPage from "../../src/pages/playlists/_PlaylistPage";
import { createStores, StoresProvider } from "../../src/stores";
import fixture from "./shows.json";
import "../../src/styles/styles.css";

const stores = createStores();
stores.initialize = async () => {
	if (
		location.pathname !== "/playlists/" ||
		new URLSearchParams(location.search).has("catalogFail")
	) {
		throw new Error("Catalog unavailable");
	}
};
stores.showStore.get = (id) => {
	const show = fixture.data[0];
	return id === 42 && show ? { ...show, id: 42, tagIds: [] } : undefined;
};
if (new URLSearchParams(location.search).has("fail")) {
	stores.playlistStore.initialize = async () => {
		throw new Error("Storage unavailable");
	};
}
Object.assign(window, { playlistFixture: { stores } });
const root = document.getElementById("root");
if (!root) {
	throw new Error("Missing root");
}
createRoot(root).render(
	<StoresProvider stores={stores}>
		{location.pathname === "/playlists/" ? <PlaylistPage /> : <HistoryPane />}
	</StoresProvider>,
);
