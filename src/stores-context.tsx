import { createContext, type ReactNode, useContext } from "react";
import { type Stores, stores } from "./stores";

const StoresContext = createContext<Stores>(stores);

type Props = {
	stores: Stores;
	children: ReactNode;
};

export function StoresProvider({ stores, children }: Props) {
	return (
		<StoresContext.Provider value={stores}>{children}</StoresContext.Provider>
	);
}

export function useStores(): Stores {
	return useContext(StoresContext);
}
