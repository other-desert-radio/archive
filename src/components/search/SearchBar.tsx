import type { ReactElement } from "react";

type Props = {
	value: string;
	onChange: (value: string) => void;
};

/** Panes own the query; this input reports edits without accessing stores. */
export default function SearchBar(_props: Props): ReactElement {
	throw new Error("Not implemented");
}
