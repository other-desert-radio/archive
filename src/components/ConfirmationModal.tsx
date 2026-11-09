import { type ReactNode, type Ref, useId } from "react";
import styles from "./ConfirmationModal.module.css";

type ConfirmationModalProps = {
	ref: Ref<HTMLDialogElement>;
	title: string;
	body: ReactNode;
	primaryAction: {
		label: string;
		onClick: () => void;
		destructive: boolean;
	};
	cancelLabel: string;
	pending: boolean;
	error?: string | undefined;
	onClose: () => void;
};

export default function ConfirmationModal({
	ref,
	title,
	body,
	primaryAction,
	cancelLabel,
	pending,
	error,
	onClose,
}: ConfirmationModalProps) {
	const titleId = useId();
	const bodyId = useId();
	return (
		<dialog
			ref={ref}
			className={styles["modal"]}
			aria-labelledby={titleId}
			aria-describedby={bodyId}
			aria-busy={pending}
			onClose={onClose}
			onCancel={(event) => {
				if (pending) {
					event.preventDefault();
				}
			}}
		>
			<h2 id={titleId}>{title}</h2>
			<div id={bodyId}>{body}</div>
			{error && <p role="alert">{error}</p>}
			<div className={styles["actions"]}>
				<button
					type="button"
					className="button-primary"
					aria-label={cancelLabel}
					ref={(button) => {
						if (button) {
							button.autofocus = true;
						}
					}}
					disabled={pending}
					onClick={(event) => event.currentTarget.closest("dialog")?.close()}
				>
					{cancelLabel}
				</button>
				<button
					type="button"
					className={`button-primary${primaryAction.destructive ? " button-danger" : ""}`}
					aria-label={primaryAction.label}
					disabled={pending}
					onClick={primaryAction.onClick}
				>
					{primaryAction.label}
				</button>
			</div>
		</dialog>
	);
}
