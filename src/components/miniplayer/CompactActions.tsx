import type { ReactElement } from "react";

type Props = {
	hidden: boolean;
	onExpand: () => void;
};

// Both controls delegate presentation changes to the parent hook.
export function MobileExpand(_props: Props): ReactElement {
	throw new Error("Not implemented");
}

export function DesktopActions(_props: Props): ReactElement {
	throw new Error("Not implemented");
}
