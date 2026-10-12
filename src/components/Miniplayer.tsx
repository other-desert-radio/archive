import { useState } from "react";
import FullscreenPlayer from "./FullscreenPlayer";

export default function Miniplayer() {
	const [fullscreenOpen, setFullscreenOpen] = useState(false);

	return (
		<div data-miniplayer>
			MUSIC GOES HERE{" "}
			<button
				type="button"
				aria-label="Open fullscreen player"
				aria-haspopup="dialog"
				onClick={() => setFullscreenOpen(true)}
			>
				Fullscreen
			</button>
			{fullscreenOpen && (
				<FullscreenPlayer onClose={() => setFullscreenOpen(false)} />
			)}
		</div>
	);
}
