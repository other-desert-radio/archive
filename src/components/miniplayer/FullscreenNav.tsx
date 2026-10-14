import type { ReactElement } from "react";

type Props = {
	base: string;
	onClose: () => void;
};

// Presentational only: the parent owns closing and scroll-lock cleanup.
export default function FullscreenNav(_props: Props): ReactElement {
	throw new Error("Not implemented");
}
