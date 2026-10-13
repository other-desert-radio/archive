import { useEffect, useRef } from "react";
import { useAudioState } from "../stores/audio";
import styles from "./FullscreenPlayer.module.css";

type Props = {
	onClose: () => void;
};

export default function FullscreenPlayer({ onClose }: Props) {
	const dialogRef = useRef<HTMLDialogElement>(null);
	const audio = useAudioState();

	useEffect(() => {
		dialogRef.current?.showModal();
	}, []);

	if (audio.status === "idle") return null;

	return (
		<dialog
			ref={dialogRef}
			className={styles["fullscreen-player"]}
			data-fullscreen-player
			aria-label="Fullscreen player"
			onClose={onClose}
		>
			<div className={styles["header"]}>
				<p>OTHER DESERT RADIO</p>

				<button
					type="button"
					aria-label="Close fullscreen player"
					onClick={() => dialogRef.current?.close()}
				>
					Close
				</button>
			</div>
			<p>{audio.track.title}</p>
		</dialog>
	);
}
