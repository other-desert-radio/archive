import type { ReactElement } from "react";
import type { Show } from "../../utils/fetch-shows";

type Props = {
	show: Show;
	base: string;
	hidden?: boolean;
};

export default function TrackTitle(_props: Props): ReactElement {
	throw new Error("Not implemented");
}
