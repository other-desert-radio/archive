import { readFile } from "node:fs/promises";
import { isMatching, P } from "ts-pattern";

const DJPattern = {
	id: P.number,
	title: P.string,
	image_small: P.string,
	image_large: P.string,
	tagIds: P.array(P.number),
};

export type DJ = P.infer<typeof DJPattern>;

export async function fetchDJs(url: URL): Promise<DJ[]> {
	const source = await readFile(url, "utf8");
	const data: unknown = JSON.parse(source);

	if (!isMatching({ data: P.array(DJPattern) }, data)) {
		throw new Error("DJ summary data has an unexpected format.");
	}

	return data.data;
}
