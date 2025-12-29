import { useEffect, useState } from "react";
import api from "../../api/client";
import { useAuth } from "../../context/AuthContext";

function formatDateTime(value) {
	if (!value) return "-";
	const d = new Date(value);
	if (Number.isNaN(d.getTime())) return value;
	return d.toLocaleString();
}

export default function ClientDangerZone({ clientId, clientName }) {
	const { user } = useAuth();
	const [requests, setRequests] = useState([]);
	const [loading, setLoading] = useState(true);
	const [actionLoading, setActionLoading] = useState(false);
	const [error, setError] = useState("");

	const isAdmin = user?.role === "Admin";
	const isOwner = user?.role === "Owner";

	const loadRequests = async () => {
		if (!clientId) return;
		setLoading(true);
		setError("");
		try {
			const res = await api.get(`/clients/${clientId}/purge-requests`);
			setRequests(res.data || []);
		} catch (err) {
			console.error(err);
			setError("Failed to load purge history.");
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		loadRequests();
	}, [clientId]);

	const pendingRequest = requests.find((r) => r.status === "pending");

	const handleRequestPurge = async () => {
		if (
			!window.confirm(
				`Request purge for client "${
					clientName || clientId
				}"?\n\nThis will not immediately delete anything. The owner must approve before the purge is executed.`
			)
		) {
			return;
		}

		setActionLoading(true);
		setError("");
		try {
			await api.post(`/clients/${clientId}/purge-request`);
			await loadRequests();
		} catch (err) {
			console.error(err);
			const message =
				err.response?.data?.detail || "Failed to create purge request.";
			setError(message);
		} finally {
			setActionLoading(false);
		}
	};

	const handleApproveAndPurge = async () => {
		if (!pendingRequest) return;

		if (
			!window.confirm(
				`Owner approval required.\n\nThis will permanently purge client "${
					clientName || clientId
				}" and related data (tasks, accounts, documents metadata).\n\nThis cannot be undone. Are you sure?`
			)
		) {
			return;
		}

		setActionLoading(true);
		setError("");
		try {
			await api.post(
				`/clients/${clientId}/purge-request/${pendingRequest.id}/approve`
			);
			// After purge, it's safest to redirect away from the now-deleted client
			window.location.href = "/clients";
		} catch (err) {
			console.error(err);
			const message =
				err.response?.data?.detail || "Failed to approve and execute purge.";
			setError(message);
		} finally {
			setActionLoading(false);
		}
	};
	return (
		<div className="space-y-4">
			{/* Header + warning copy */}
			<div className="border border-red-200 bg-red-50 rounded-xl px-4 py-3">
				<h2 className="text-sm font-semibold text-red-800 flex items-center gap-2">
					<span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-100 text-[11px] font-bold">
						!
					</span>
					Danger Zone
				</h2>
				<p className="mt-1 text-xs text-red-800 leading-snug">
					Purging a client permanently removes the client record and related
					operational data (tasks, accounts, and document metadata). This action
					requires an <span className="font-semibold">Admin</span> to request
					the purge and the <span className="font-semibold">Owner</span> to
					approve it.
				</p>
			</div>

			{error && (
				<div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
					{error}
				</div>
			)}

			{/* Action row */}
			<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
				<div className="text-xs text-slate-600">
					<p>
						Client:{" "}
						<span className="font-medium text-slate-900">
							{clientName || `#${clientId}`}
						</span>
					</p>
					<p className="mt-1">
						Only Admin and Owner roles can initiate or approve purge actions.
						All actions are logged.
					</p>
				</div>

				<div className="flex flex-wrap gap-2 justify-start sm:justify-end">
					{isAdmin && !isOwner && (
						<button
							type="button"
							onClick={handleRequestPurge}
							disabled={!!pendingRequest || actionLoading}
							className={`inline-flex items-center rounded-md border px-3 py-1.5 text-xs font-semibold ${
								pendingRequest
									? "border-slate-300 text-slate-400 bg-slate-50 cursor-not-allowed"
									: "border-red-300 text-red-700 bg-white hover:bg-red-50"
							}`}
						>
							{pendingRequest ? "Purge requested" : "Request purge"}
						</button>
					)}

					{isOwner && pendingRequest && (
						<button
							type="button"
							onClick={handleApproveAndPurge}
							disabled={actionLoading}
							className="inline-flex items-center rounded-md border border-red-500 bg-red-600 text-white px-3 py-1.5 text-xs font-semibold hover:bg-red-700 disabled:opacity-60"
						>
							Approve & purge
						</button>
					)}

					{!isAdmin && !isOwner && (
						<span className="text-[11px] text-slate-500">
							Purge actions are restricted to Admin and Owner roles.
						</span>
					)}
				</div>
			</div>
			{/* Status summary */}
			<div className="text-xs text-slate-500">
				{loading ? (
					"Loading purge status..."
				) : pendingRequest ? (
					<>
						Pending purge request created{" "}
						{formatDateTime(pendingRequest.created_at)} by user #
						{pendingRequest.requested_by_id}. Awaiting owner approval.
					</>
				) : (
					"No active purge requests for this client."
				)}
			</div>

			{/* History */}
			<div className="mt-2 border border-slate-200 rounded-xl bg-white overflow-hidden">
				<div className="px-3 py-2 border-b border-slate-100 text-xs font-semibold text-slate-600">
					Purge history
				</div>
				{loading ? (
					<div className="px-3 py-2 text-xs text-slate-500">Loading...</div>
				) : requests.length === 0 ? (
					<div className="px-3 py-2 text-xs text-slate-500">
						No purge activity for this client.
					</div>
				) : (
					<table className="min-w-full text-xs">
						<thead className="bg-slate-50 text-[11px] uppercase text-slate-500">
							<tr>
								<th className="px-3 py-1 text-left">Status</th>
								<th className="px-3 py-1 text-left">Requested by</th>
								<th className="px-3 py-1 text-left">Created</th>
								<th className="px-3 py-1 text-left">Approved by</th>
								<th className="px-3 py-1 text-left">Executed</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-slate-100">
							{requests.map((r) => (
								<tr key={r.id}>
									<td className="px-3 py-1.5">
										<span
											className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
												r.status === "pending"
													? "bg-amber-50 text-amber-700 border border-amber-100"
													: r.status === "executed"
													? "bg-emerald-50 text-emerald-700 border border-emerald-100"
													: "bg-slate-50 text-slate-600 border border-slate-100"
											}`}
										>
											{r.status}
										</span>
									</td>
									<td className="px-3 py-1.5 text-slate-700">
										#{r.requested_by_id}
									</td>
									<td className="px-3 py-1.5 text-slate-700">
										{formatDateTime(r.created_at)}
									</td>
									<td className="px-3 py-1.5 text-slate-700">
										{r.approved_by_id ? `#${r.approved_by_id}` : "-"}
									</td>
									<td className="px-3 py-1.5 text-slate-700">
										{formatDateTime(r.executed_at)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				)}
			</div>
		</div>
	);
}
