import type { ReactNode } from "react";
import type { InitializationStatus } from "../hooks/useInitialization";

type Props = {
	status: InitializationStatus;
	loading: string;
	error: string;
	children: ReactNode;
};

export default function LoadingState({
	status,
	loading,
	error,
	children,
}: Props) {
	if (status === "loading") {
		return <p role="status">{loading}</p>;
	}
	if (status === "error") {
		return <p role="alert">{error}</p>;
	}
	return children;
}
