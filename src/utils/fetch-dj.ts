import { readFile } from "node:fs/promises";
import { isMatching, P } from "ts-pattern";

const HydratedDJPattern = {
	id: P.number,
	title: P.string,
	image_small: P.string,
	image_large: P.string,
	bio: P.string,
	socials: P.string,
	showTitle: P.string,
	showDescription: P.string,
	shows: P.array(P.unknown),
	tagIds: P.array(P.number),
};

export type HydratedDJ = P.infer<typeof HydratedDJPattern>;

export const fetchDJ = async (url: URL): Promise<HydratedDJ> => {
	const source = await readFile(url, "utf8");
	const data: unknown = JSON.parse(source);

	if (!isMatching({ data: HydratedDJPattern }, data)) {
		throw new Error("Hydrated DJ data has an unexpected format.");
	}

	return data.data;
};
