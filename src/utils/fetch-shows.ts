import { readFile } from "node:fs/promises";
import { isMatching, P } from "ts-pattern";
import {
	AssetReferencePattern,
	HttpUrlPattern,
	IsoDatePattern,
} from "./patterns";

const ShowPattern = {
	id: P.number,
	title: P.string,
	date: IsoDatePattern,
	duration: P.number,
	description: P.optional(P.string),
	image_small: AssetReferencePattern,
	image_large: AssetReferencePattern,
	djs: P.array({
		id: P.number,
		title: P.string,
		image_small: P.string,
		image_large: P.string,
	}),
	tagIds: P.array(P.number),
	url: HttpUrlPattern,
};

export type Show = P.infer<typeof ShowPattern>;

export const fetchShows = async (url: URL): Promise<Show[]> => {
	const source = await readFile(url, "utf8");
	const data: unknown = JSON.parse(source);

	if (!isMatching({ data: P.array(ShowPattern) }, data)) {
		throw new Error("Show data has an unexpected format.");
	}

	return data.data;
};
