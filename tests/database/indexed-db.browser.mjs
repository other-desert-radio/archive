// Planned real-browser checks; disconnected until the implementation is ready.
async function verifyPersistence() {
	throw new Error("Not implemented");
}

async function verifyTransactionRollback() {
	throw new Error("Not implemented");
}

export async function runIndexedDBChecks() {
	await verifyPersistence();
	await verifyTransactionRollback();
}
