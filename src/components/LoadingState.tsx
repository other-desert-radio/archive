import type { ReactNode } from "react";
import type { InitializationStatus } from "../hooks/useInitialization";

type Props = {
	status: InitializationStatus;
	loading: ReactNode;
	error: ReactNode;
	className?: string | undefined;
	children?: ReactNode;
};

export default function LoadingState({
	status,
	loading,
	error,
	children,
	className,
}: Props) {
	if (status === "loading") {
		return loading == null ? null : (
			<p role="status" className={className}>
				{loading}
			</p>
		);
	}
	if (status === "error") {
		return (
			<p role="alert" className={className}>
				{error}
			</p>
		);
	}
	return children;
}
