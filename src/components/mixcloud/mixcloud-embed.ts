export type MixcloudEmbedParams = {
	mini: boolean;
	hide_cover: boolean;
	hide_artwork: boolean;
	light: boolean;
};

export function mixcloudEmbedUrl(
	cloudcastKey: string,
	{ mini, hide_cover, hide_artwork, light }: MixcloudEmbedParams,
): string {
	if (!/^\/[^/?#\s]+\/[^/?#\s]+\/$/.test(cloudcastKey)) {
		throw new Error("Expected a Mixcloud show key such as /dj/show/.");
	}
	const url = new URL("https://player-widget.mixcloud.com/widget/iframe/");
	url.searchParams.set("mini", mini ? "1" : "0");
	url.searchParams.set("hide_cover", hide_cover ? "1" : "0");
	url.searchParams.set("hide_artwork", hide_artwork ? "1" : "0");
	url.searchParams.set("light", light ? "1" : "0");
	url.searchParams.set("feed", cloudcastKey);
	return url.href;
}
