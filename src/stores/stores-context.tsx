import { createContext, type ReactNode, useContext, useEffect } from "react";
import { type Stores, stores } from "./stores";

const StoresContext = createContext<Stores>(stores);

type Props = {
	stores: Stores;
	children: ReactNode;
};

// Overrides the shared stores for descendants, allowing isolated instances in tests.
export function StoresProvider({ stores, children }: Props) {
	return (
		<StoresContext.Provider value={stores}>{children}</StoresContext.Provider>
	);
}

export function useStores(): Stores {
	const stores = useContext(StoresContext);
	useEffect(() => {
		void stores.initialize().catch((error: unknown) => {
			console.error("[Stores] initialization failed", error);
		});
	}, [stores]);
	return stores;
}
