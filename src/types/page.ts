export type Page =
	| {
			name: "explore" | "shows" | "djs" | "history" | "dj_page" | "show_page";
	  }
	| {
			name: "tag_page";
			color: string;
	  };
