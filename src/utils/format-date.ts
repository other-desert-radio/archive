/**
 * Formats a show timestamp for display in the archive.
 *
 * ISO timestamp --> "Month day, year"
 */
export const formatDate = (date: string): string =>
	new Intl.DateTimeFormat("en-US", {
		day: "numeric",
		month: "long",
		timeZone: "UTC",
		year: "numeric",
	}).format(new Date(date));

/** Formats a local entry update time without a year. */
export function formatDateTime(date: string): string {
	const timestamp = new Date(date);
	const day = timestamp.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
	});
	const time = timestamp
		.toLocaleTimeString("en-US", {
			hour: "numeric",
			minute: "2-digit",
			hour12: true,
		})
		.toLowerCase()
		.replace(/\s+(am|pm)$/, "$1");
	return `${day}, ${time}`;
}
