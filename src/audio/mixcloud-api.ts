import { isMatching, P } from "ts-pattern";

type WidgetEvent = {
	on: (listener: () => void) => void;
	off: (listener: () => void) => void;
};

// Only the methods/events needed by the first playback adapter.
// Mixcloud adds these after widget.ready resolves.
export type MixcloudWidget = {
	load: (cloudcastKey: string, startPlaying: boolean) => PromiseLike<unknown>;
	play: () => PromiseLike<unknown>;
	pause: () => PromiseLike<unknown>;
	events: { play: WidgetEvent; pause: WidgetEvent; error: WidgetEvent };
};

export type MixcloudApi = {
	PlayerWidget: (iframe: HTMLIFrameElement) => unknown;
};

type ScriptEnvironment = {
	readApi: () => unknown;
	appendScript: (onLoad: () => void, onError: () => void) => void;
};

function readApi(value: unknown): MixcloudApi | undefined {
	const factory = P.when(
		(candidate: unknown): candidate is (...args: unknown[]) => unknown =>
			typeof candidate === "function",
	);
	if (!isMatching({ PlayerWidget: factory }, value)) return undefined;
	return { PlayerWidget: (iframe) => value.PlayerWidget(iframe) };
}

// A separate factory permits isolated tests without browser globals.
export function createMixcloudApiLoader(environment: ScriptEnvironment) {
	let pending: Promise<MixcloudApi> | undefined;
	return function load(): Promise<MixcloudApi> {
		if (pending) return pending;
		const existing = readApi(environment.readApi());
		if (existing) return Promise.resolve(existing);
		pending = new Promise<MixcloudApi>((resolve, reject) => {
			environment.appendScript(
				() => {
					const api = readApi(environment.readApi());
					if (api) resolve(api);
					else reject(new Error("Mixcloud widget API is unavailable."));
				},
				() => reject(new Error("Could not load the Mixcloud widget API.")),
			);
		}).catch((error: unknown) => {
			pending = undefined;
			throw error;
		});
		return pending;
	};
}

// Browser globals are accessed only when called, never during Astro SSR.
export const loadMixcloudApi = createMixcloudApiLoader({
	readApi: () => Reflect.get(window, "Mixcloud"),
	appendScript: (onLoad, onError) => {
		const script = document.createElement("script");
		script.src = "https://widget.mixcloud.com/media/js/widgetApi.js";
		script.async = true;
		script.addEventListener(
			"load",
			() => {
				script.remove();
				onLoad();
			},
			{ once: true },
		);
		script.addEventListener(
			"error",
			() => {
				script.remove();
				onError();
			},
			{ once: true },
		);
		document.head.append(script);
	},
});
