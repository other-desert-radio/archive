import { P } from "ts-pattern";

/**
 * Matches ISO calendar dates, optionally followed by a UTC timestamp with
 * seconds and optional millisecond precision (for example, 2026-05-25 or
 * 2026-05-25T00:00:00.000Z).
 */
export const IsoDatePattern = P.string.regex(
	/^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z)?$/,
);

/** Matches non-whitespace HTTP and HTTPS URLs with a host. */
export const HttpUrlPattern = P.string.regex(/^https?:\/\/[^\s/]+(?:[^\s]*)$/);

/**
 * Matches non-whitespace relative or root-relative asset paths, plus absolute
 * HTTP and HTTPS asset URLs.
 */
export const AssetReferencePattern = P.string.regex(
	/^(?:https?:\/\/[^\s/]+[^\s]*|\/?[^\s]+)$/,
);

export const VersionPattern = { id: P.number, updatedAt: IsoDatePattern };
export const VersionsPattern = {
	shows: VersionPattern,
	djs: VersionPattern,
	tags: VersionPattern,
};
