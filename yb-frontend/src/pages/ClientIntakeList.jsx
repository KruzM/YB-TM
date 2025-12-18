// src/pages/ClientIntakeList.jsx
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function ClientIntakeList() {
	const [intakes, setIntakes] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [search, setSearch] = useState("");
	const [convertingId, setConvertingId] = useState(null);
	const { user } = useAuth();
	const isAdmin = ["admin", "owner"].includes(
		String(user?.role || "").toLowerCase()
	);
	const navigate = useNavigate();

	const loadIntakes = async () => {
		setLoading(true);
		setError("");
		try {
			const res = await api.get("/intake", {
				params: search ? { search } : undefined,
			});
			setIntakes(res.data || []);
		} catch (err) {
			console.error(err);
			setError("Failed to load intake forms.");
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		loadIntakes();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);
	const handleDeleteIntake = async (id) => {
		const typed = window.prompt(
			"Type DELETE to permanently remove this intake form:"
		);
		if (typed !== "DELETE") return;

		try {
			await api.delete(`/intake/${id}`);
			await loadIntakes();
		} catch (err) {
			console.error(err);
			alert(err?.response?.data?.detail || "Failed to delete intake.");
		}
	};
	const handleConvert = async (id) => {
		if (!window.confirm("Create a Client from this intake form?")) return;
		setConvertingId(id);
		try {
			const res = await api.post(`/intake/${id}/convert-to-client`);
			const client = res.data;
			// Reload list so status / linked client updates
			await loadIntakes();
			// Jump into the new client
			navigate(`/clients/${client.id}`);
		} catch (err) {
			console.error(err);
			alert("Failed to create client from this intake.");
		} finally {
			setConvertingId(null);
		}
	};

	const handleSearchSubmit = (e) => {
		e.preventDefault();
		loadIntakes();
	};

	const statusLabel = (status) => {
		if (!status) return "new";
		return status.replace("_", " ");
	};

	return (
		<div className="space-y-5">
			{/* Header */}
			<div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
				<div>
					<div className="text-xs uppercase tracking-[0.18em] text-yecny-slate mb-1">
						Client intake
					</div>
					<h1 className="text-2xl font-semibold text-yecny-charcoal">
						Intake forms
					</h1>
					<p className="text-xs text-yecny-slate mt-1 max-w-xl">
						Review discovery call forms and convert completed intakes into live
						client records.
					</p>
				</div>
				<div>
					<button
						onClick={() => navigate("/clients/intake/new")}
						className="px-4 py-2 rounded-md bg-yecny-primary text-white text-sm font-medium hover:bg-yecny-primary-dark"
					>
						+ New intake
					</button>
				</div>
			</div>

			{/* Search */}
			<form
				onSubmit={handleSearchSubmit}
				className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-col md:flex-row gap-3 md:items-center md:justify-between"
			>
				<div className="flex-1">
					<input
						type="text"
						placeholder="Search by business name, DBA, or contact"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-yecny-primary-soft focus:border-yecny-primary"
					/>
				</div>
				<div className="flex gap-2 text-sm">
					<button
						type="submit"
						className="px-3 py-2 rounded-md border border-slate-300 bg-white text-yecny-slate hover:bg-slate-50"
					>
						Search
					</button>
					<button
						type="button"
						onClick={() => {
							setSearch("");
							loadIntakes();
						}}
						className="px-3 py-2 rounded-md border border-slate-300 bg-white text-yecny-slate hover:bg-slate-50"
					>
						Clear
					</button>
				</div>
			</form>

			{/* List */}
			<div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
				<div className="px-4 py-2 border-b border-slate-200 text-xs text-yecny-slate flex justify-between">
					<span>
						{loading
							? "Loading intake forms..."
							: `${intakes.length} record${intakes.length === 1 ? "" : "s"}`}
					</span>
				</div>

				{error && (
					<div className="px-4 py-2 text-sm text-red-700 bg-red-50 border-b border-red-100">
						{error}
					</div>
				)}

				{!loading && intakes.length === 0 && !error && (
					<div className="px-4 py-6 text-sm text-yecny-slate">
						No intake forms yet. Start with &quot;New intake&quot; to log your
						next discovery call.
					</div>
				)}

				{!loading && intakes.length > 0 && (
					<div className="overflow-x-auto">
						<table className="min-w-full text-sm">
							<thead className="bg-slate-50">
								<tr>
									<th className="text-left px-4 py-2 font-medium text-yecny-slate">
										Business
									</th>
									<th className="text-left px-4 py-2 font-medium text-yecny-slate">
										Primary contact
									</th>
									<th className="text-left px-4 py-2 font-medium text-yecny-slate">
										Status
									</th>
									<th className="text-left px-4 py-2 font-medium text-yecny-slate">
										Created
									</th>
									<th className="text-left px-4 py-2 font-medium text-yecny-slate">
										Linked client
									</th>
									<th className="px-4 py-2 text-right font-medium text-yecny-slate">
										Actions
									</th>
								</tr>
							</thead>
							<tbody>
								{intakes.map((i, idx) => {
									const isLast = idx === intakes.length - 1;
									const createdLabel = i.created_at
										? new Date(i.created_at).toLocaleDateString()
										: "-";
									return (
										<tr
											key={i.id}
											className={
												"hover:bg-slate-50 transition-colors" +
												(isLast ? "" : " border-b border-slate-100")
											}
										>
											<td className="px-4 py-2">
												<div className="font-medium text-yecny-charcoal">
													{i.legal_name || i.dba_name || "Untitled"}
												</div>
												{i.dba_name && (
													<div className="text-xs text-yecny-slate">
														DBA {i.dba_name}
													</div>
												)}
											</td>
											<td className="px-4 py-2 text-xs text-yecny-slate">
												{i.primary_contact_name || "?"}
												{i.primary_contact_email && (
													<>
														<span className="text-slate-400"> - </span>
														{i.primary_contact_email}
													</>
												)}
											</td>
											<td className="px-4 py-2 text-xs">
												<span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-50 border border-slate-200 text-slate-700">
													{statusLabel(i.status)}
												</span>
											</td>
											<td className="px-4 py-2 text-xs text-yecny-slate">
												{createdLabel}
											</td>
											<td className="px-4 py-2 text-xs">
												{i.client_id ? (
													<span className="text-emerald-600">Linked</span>
												) : (
													<span className="text-slate-400">Not created</span>
												)}
											</td>
											<td className="px-4 py-2 text-right text-xs">
												<div className="flex justify-end gap-2">
													{/* View / Edit intake form */}
													<Link
														to={`/clients/intake/${i.id}/edit`}
														className="px-3 py-1.5 rounded-md border border-slate-300 bg-white text-yecny-slate hover:bg-slate-50"
													>
														View / Edit intake
													</Link>
													{/* Delete intake form */}
													{isAdmin && (
														<button
															type="button"
															onClick={() => handleDeleteIntake(i.id)}
															className="px-3 py-1.5 rounded-md border border-red-200 bg-white text-red-600 hover:bg-red-50"
														>
															Delete
														</button>
													)}
													{/* Create or view client */}
													{i.client_id ? (
														<Link
															to={`/clients/${i.client_id}`}
															className="px-3 py-1.5 rounded-md bg-yecny-primary text-white hover:bg-yecny-primary-dark"
														>
															View client
														</Link>
													) : (
														<button
															type="button"
															onClick={() => handleConvert(i.id)}
															disabled={convertingId === i.id}
															className="px-3 py-1.5 rounded-md bg-yecny-primary text-white hover:bg-yecny-primary-dark disabled:opacity-60"
														>
															{convertingId === i.id
																? "Creating..."
																: "Create client"}
														</button>
													)}
												</div>
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				)}
			</div>
		</div>
	);
}
