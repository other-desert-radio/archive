import type { ReactElement } from "react";
import styles from "./SearchBar.module.css";

type Props = {
	value: string;
	onChange: (value: string) => void;
};

/** Panes own the query; this input reports edits without accessing stores. */
export default function SearchBar({ value, onChange }: Props): ReactElement {
	return (
		<div className={styles["search"]}>
			<input
				type="search"
				aria-label="Search"
				placeholder="SEARCH..."
				className={styles["input"]}
				value={value}
				onChange={(event) => onChange(event.currentTarget.value)}
			/>
			{value !== "" && (
				<button
					type="button"
					aria-label="Clear search"
					className={styles["clear"]}
					onClick={() => onChange("")}
				>
					<svg
						width="20"
						height="20"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						aria-hidden="true"
					>
						<path d="m6 6 12 12M6 18 18 6" />
					</svg>
				</button>
			)}
		</div>
	);
}
