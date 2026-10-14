// Preserve page position/styles while locked; cleanup restores both.
// usePlayerPresentation will release the lock on close or unmount.
export function lockBackgroundScroll(): () => void {
	throw new Error("Not implemented");
}
