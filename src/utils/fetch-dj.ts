import { readFile } from "node:fs/promises";
import { isMatching, P } from "ts-pattern";

const HydratedDJPattern = {
	id: P.number,
	title: P.string,
	image_small: P.optional(P.string),
	image_large: P.optional(P.string),
	bio: P.optional(P.union(P.string, P.nullish)),
	socials: P.optional(P.string),
	showTitle: P.optional(P.string),
	showDescription: P.optional(P.string),
	shows: P.array(P.unknown),
	tagIds: P.array(P.number),
};

export type HydratedDJ = Omit<P.infer<typeof HydratedDJPattern>, "bio"> & {
	bio?: string | undefined;
};

export const fetchDJ = async (url: URL): Promise<HydratedDJ> => {
	const source = await readFile(url, "utf8");
	const data: unknown = JSON.parse(source);

	if (!isMatching({ data: HydratedDJPattern }, data)) {
		throw new Error("Hydrated DJ data has an unexpected format.");
	}

	return { ...data.data, bio: data.data.bio ?? undefined };
};
