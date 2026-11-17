import { P } from "ts-pattern";
import { IsoDatePattern } from "../../utils/patterns";

const StartTimePattern = P.optional(P.number.int().gte(0));

export const ShowDetailEntryPattern = P.union(
	{ artist: P.string, song: P.string, start_time: StartTimePattern },
	{ chapter: P.string, start_time: StartTimePattern },
);

export const ShowDetailPattern = {
	id: P.number,
	description: P.optional(P.string),
	tracklist: P.optional(P.array(ShowDetailEntryPattern)),
};

export const ShowDetailsExportPattern = {
	version: P.number.finite(),
	updatedAt: IsoDatePattern,
	data: P.array(ShowDetailPattern),
};

export type ShowDetailEntry = P.infer<typeof ShowDetailEntryPattern>;
export type ShowDetail = P.infer<typeof ShowDetailPattern>;
export type ShowDetailsExport = P.infer<typeof ShowDetailsExportPattern>;
