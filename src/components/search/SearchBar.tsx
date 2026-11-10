import type { ReactElement } from "react";
import styles from "./SearchBar.module.css";

type Props = {
	value: string;
	onChange: (value: string) => void;
};

/** Panes own the query; this input reports edits without accessing stores. */
export default function SearchBar({ value, onChange }: Props): ReactElement {
	return (
		<input
			type="search"
			aria-label="Search"
			placeholder="SEARCH..."
			className={styles["input"]}
			value={value}
			onChange={(event) => onChange(event.currentTarget.value)}
		/>
	);
}
