export default function ExplorePane({ base, tags }: Props) {
	if (tags.length === 0) {
		return <p>No tags found.</p>;
	}

	return (
		<div className={styles["tags-container"]}>
			{tags.map((tag) => (
				<ExploreTag key={tag.id} tag={tag} />
			))}
		</div>
	);
}
