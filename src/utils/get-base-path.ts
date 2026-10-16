/** Return the site base path without a trailing slash; root hosting returns "". */
export function getBasePath(
	base: string = import.meta.env.BASE_URL ?? "/",
): string {
	return base.replace(/\/$/, "");
}
