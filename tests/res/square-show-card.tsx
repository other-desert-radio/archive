import { hydrateRoot } from "react-dom/client";
import SquareShowCard from "../../src/components/shows/SquareShowCard";
import { createStores, StoresProvider } from "../../src/stores";
import fixture from "./shows.json";
import "../../src/styles/styles.css";

const show = fixture.data[0];
if (!show) throw new Error("Missing show fixture");
const stores = createStores();
// Local progress must load even when catalog refresh fails.
stores.initialize = async () => {
	throw new Error("Catalog unavailable");
};
Object.assign(window, { cardFixture: { stores, show } });
const root = document.getElementById("root");
if (!root) throw new Error("Missing root");
hydrateRoot(
	root,
	<StoresProvider stores={stores}>
		<div id="playback">
			<SquareShowCard mode="playback" show={show} base="" />
		</div>
		<div id="details">
			<SquareShowCard
				mode="details"
				tags={[{ id: 1, title: "Ambient", color: "#ff0000" }]}
				show={show}
				base=""
				fromTag={7}
			/>
		</div>
	</StoresProvider>,
);
