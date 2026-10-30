import { readFile } from "node:fs/promises";
import { isMatching, P } from "ts-pattern";

const TagPattern = {
	id: P.number,
	title: P.string,
	color: P.string,
};

export type Tag = P.infer<typeof TagPattern>;
export type ID = number;

export type TagMap = Map<ID, Tag>;

export async function fetchTags(url: URL): Promise<TagMap> {
	const source = await readFile(url, "utf8");
	const data: unknown = JSON.parse(source);

	if (!isMatching({ data: P.array(TagPattern) }, data)) {
		throw new Error("Tag data has an unexpected format.");
	}

	return new Map(data.data.map((tag) => [tag.id, tag]));
}
