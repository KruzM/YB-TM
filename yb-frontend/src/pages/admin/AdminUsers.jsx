import { useEffect, useMemo, useState } from "react";
import api from "../../api/client";

const ROLE_OPTIONS = [
	{ value: "bookkeeper", label: "Bookkeeper" },
	{ value: "manager", label: "Manager" },
	{ value: "admin", label: "Admin" },
	{ value: "owner", label: "Owner" },
	{ value: "client", label: "Client" },
];
// copyToClipboard will be defined inside the component so it can call flashSaved

export default function AdminUsers() {
	const [users, setUsers] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [savedMsg, setSavedMsg] = useState("");

	// create form
	const [newName, setNewName] = useState("");
	const [newEmail, setNewEmail] = useState("");
	const [newRole, setNewRole] = useState("bookkeeper");
	const [newManagerId, setNewManagerId] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [creating, setCreating] = useState(false);

	// search
	const [search, setSearch] = useState("");

	// row actions
	const [savingId, setSavingId] = useState(null);
	const [resettingId, setResettingId] = useState(null);

	// reset password modal
	const [resetOpen, setResetOpen] = useState(false);
	const [resetUser, setResetUser] = useState(null);
	const [resetPassword, setResetPassword] = useState("");
	const [resetResult, setResetResult] = useState(""); // temp password returned

	const loadUsers = async () => {
		setLoading(true);
		setError("");
		try {
			const res = await api.get("/users");
			const list = (res.data || []).map((u) => ({
				...u,
				_orig_name: u.name || "",
				_orig_email: u.email || "",
			}));
			setUsers(list);
		} catch (e) {
			console.error(e);
			setError("Failed to load users.");
			setUsers([]);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		loadUsers();
	}, []);

	const filtered = useMemo(() => {
		const q = search.trim().toLowerCase();
		if (!q) return users;
		return users.filter((u) => {
			const name = (u.name || "").toLowerCase();
			const email = (u.email || "").toLowerCase();
			const role = (u.role || "").toLowerCase();
			return name.includes(q) || email.includes(q) || role.includes(q);
		});
	}, [users, search]);
	const managers = useMemo(() => {
		return users
			.filter((u) => (u.role || "").toLowerCase() === "manager" && u.is_active)
			.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
	}, [users]);
	const flashSaved = (msg = "Saved.") => {
		setSavedMsg(msg);
		setTimeout(() => setSavedMsg(""), 1500);
	};

	const copyToClipboard = async (text) => {
		if (!text) return;
		try {
			if (navigator.clipboard && navigator.clipboard.writeText) {
				await navigator.clipboard.writeText(text);
				flashSaved("Copied.");
				return;
			}
			// fallback using textarea + execCommand
			const ta = document.createElement("textarea");
			ta.value = text;
			ta.setAttribute("readonly", "");
			ta.style.position = "absolute";
			ta.style.left = "-9999px";
			document.body.appendChild(ta);
			ta.select();
			const ok = document.execCommand("copy");
			document.body.removeChild(ta);
			if (ok) flashSaved("Copied.");
		} catch (err) {
			// ignore
		}
	};

	const handleCreate = async () => {
		const name = newName.trim();
		const email = newEmail.trim();
		const password = newPassword;

		if (!name || !email || !password) return;

		setCreating(true);
		setError("");
		try {
			const payload = {
				name,
				email,
				role: newRole,
				password,
				manager_id:
					newRole === "bookkeeper" && String(newManagerId).trim()
						? Number(newManagerId)
						: null,
			};
			const res = await api.post("/users", payload);
			const created = res.data;
			setUsers((prev) =>
				[...prev, created].sort((a, b) =>
					(a.name || "").localeCompare(b.name || "")
				)
			);
			setNewName("");
			setNewEmail("");
			setNewRole("bookkeeper");
			setNewManagerId("");
			setNewPassword("");
			flashSaved("User created.");
		} catch (e) {
			console.error(e);
			setError(e?.response?.data?.detail || "Failed to create user.");
		} finally {
			setCreating(false);
		}
	};

	const updateUser = async (userId, patch) => {
		setSavingId(userId);
		setError("");
		try {
			const res = await api.put(`/users/${userId}`, patch);
			const updated = res.data;
			setUsers((prev) =>
				prev.map((u) =>
					u.id === userId
						? {
								...updated,
								_orig_name: updated.name || "",
								_orig_email: updated.email || "",
						  }
						: u
				)
			);
			flashSaved();
		} catch (e) {
			console.error(e);
			setError(e?.response?.data?.detail || "Failed to update user.");
		} finally {
			setSavingId(null);
		}
	};

	const toggleActive = async (u) => {
		await updateUser(u.id, { is_active: !u.is_active });
	};

	const handleOpenReset = (u) => {
		setResetUser(u);
		setNewManagerId("");
		setResetPassword("");
		setResetResult("");
		setResetOpen(true);
	};

	const handleDoReset = async () => {
		if (!resetUser?.id) return;
		setResettingId(resetUser.id);
		setError("");
		setResetResult("");

		try {
			const payload = resetPassword.trim()
				? { password: resetPassword.trim() }
				: { password: null };

			const res = await api.post(
				`/users/${resetUser.id}/reset-password`,
				payload
			);
			const temp = res?.data?.temporary_password || "";
			setResetResult(temp || "(No password returned)");
			flashSaved("Password reset.");
		} catch (e) {
			console.error(e);
			setError(e?.response?.data?.detail || "Failed to reset password.");
		} finally {
			setResettingId(null);
		}
	};

	return (
		<div className="space-y-5">
			<div>
				<div className="text-[11px] uppercase tracking-[0.18em] text-yecny-slate">
					Users
				</div>
				<div className="text-sm text-slate-700">
					Create users, change roles, deactivate/reactivate, and reset
					passwords.
				</div>
			</div>

			{error && (
				<div className="text-xs px-3 py-2 rounded-md bg-red-50 text-red-700 border border-red-100">
					{error}
				</div>
			)}
			{savedMsg && (
				<div className="text-xs px-3 py-2 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100">
					{savedMsg}
				</div>
			)}

			{/* Create user */}
			<section className="rounded-xl border border-slate-200 bg-white/80 p-4 space-y-3">
				<div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
					Create user
				</div>

				<div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
					<div className="space-y-1">
						<div className="text-[11px] text-slate-500">Name</div>
						<input
							value={newName}
							onChange={(e) => setNewName(e.target.value)}
							className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-yecny-primary-soft focus:border-yecny-primary"
							placeholder="Jane Doe"
						/>
					</div>

					<div className="space-y-1">
						<div className="text-[11px] text-slate-500">Email</div>
						<input
							value={newEmail}
							onChange={(e) => setNewEmail(e.target.value)}
							className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-yecny-primary-soft focus:border-yecny-primary"
							placeholder="jane@yecny.com"
						/>
					</div>

					<div className="space-y-1">
						<div className="text-[11px] text-slate-500">Role</div>
						<select
							value={newRole}
							onChange={(e) => setNewRole(e.target.value)}
							className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-yecny-primary-soft focus:border-yecny-primary"
						>
							{ROLE_OPTIONS.map((r) => (
								<option key={r.value} value={r.value}>
									{r.label}
								</option>
							))}
						</select>
					</div>

					<div className="space-y-1">
						<div className="text-[11px] text-slate-500">Password</div>
						<input
							type="password"
							value={newPassword}
							onChange={(e) => setNewPassword(e.target.value)}
							className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-yecny-primary-soft focus:border-yecny-primary"
							placeholder="Set initial password"
						/>
					</div>
					{newRole === "bookkeeper" && (
						<div className="mt-2 max-w-sm space-y-1">
							<div className="text-[11px] text-slate-500">
								Manager (optional)
							</div>
							<select
								value={newManagerId}
								onChange={(e) => setNewManagerId(e.target.value)}
								className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-yecny-primary-soft focus:border-yecny-primary"
							>
								<option value="">- None -</option>
								{managers.map((m) => (
									<option key={m.id} value={m.id}>
										{m.name || m.email}
									</option>
								))}
							</select>
						</div>
					)}
				</div>

				<div className="flex justify-end">
					<button
						type="button"
						onClick={handleCreate}
						disabled={
							creating || !newName.trim() || !newEmail.trim() || !newPassword
						}
						className="px-4 py-2 rounded-md bg-yecny-primary text-white text-xs hover:bg-yecny-primary-dark disabled:opacity-60"
					>
						{creating ? "Creating..." : "Create user"}
					</button>
				</div>

				<div className="text-[11px] text-slate-500">
					Note: password resets return a temp password (copy it and send to the
					team member).
				</div>
			</section>

			{/* Search */}
			<section className="rounded-xl border border-slate-200 bg-white/70 px-4 py-3 space-y-2">
				<div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
					Search
				</div>
				<input
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					placeholder="Search name, email, role..."
					className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-yecny-primary-soft focus:border-yecny-primary"
				/>
			</section>

			{/* Users table */}
			<section className="rounded-xl border border-slate-200 bg-white/80 overflow-hidden">
				<div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 text-[11px] text-slate-500">
					<div>
						{filtered.length} {filtered.length === 1 ? "user" : "users"}
					</div>
					<button
						type="button"
						onClick={loadUsers}
						className="text-yecny-primary hover:underline"
						disabled={loading}
					>
						{loading ? "Refreshing..." : "Refresh"}
					</button>
				</div>

				{loading ? (
					<div className="px-4 py-4 text-xs text-slate-400">Loading...</div>
				) : filtered.length === 0 ? (
					<div className="px-4 py-6 text-xs text-slate-400 text-center">
						No users found.
					</div>
				) : (
					<div className="overflow-x-auto">
						<table className="min-w-full text-xs">
							<thead className="bg-slate-50 border-b border-slate-200">
								<tr>
									<th className="text-left px-4 py-2 font-semibold text-slate-600">
										Name
									</th>
									<th className="text-left px-4 py-2 font-semibold text-slate-600">
										Email
									</th>
									<th className="text-left px-4 py-2 font-semibold text-slate-600">
										Role
									</th>
									<th className="text-left px-4 py-2 font-semibold text-slate-600">
										Manager
									</th>
									<th className="text-left px-4 py-2 font-semibold text-slate-600">
										Status
									</th>
									<th className="text-right px-4 py-2 font-semibold text-slate-600">
										Actions
									</th>
								</tr>
							</thead>
							<tbody>
								{filtered.map((u) => {
									const rowBusy = savingId === u.id;
									return (
										<tr
											key={u.id}
											className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/60"
										>
											<td className="px-4 py-3">
												<input
													value={u.name || ""}
													onChange={(e) =>
														setUsers((prev) =>
															prev.map((x) =>
																x.id === u.id
																	? { ...x, name: e.target.value }
																	: x
															)
														)
													}
													onBlur={(e) => {
														const val = (e.target.value || "").trim();
														if (val === (u._orig_name || "")) return;
														updateUser(u.id, { name: val });
													}}
													disabled={rowBusy}
													className="w-full border border-slate-200 rounded-md px-2 py-1 text-xs bg-white disabled:opacity-60"
												/>
											</td>

											<td className="px-4 py-3">
												<input
													value={u.email || ""}
													onChange={(e) =>
														setUsers((prev) =>
															prev.map((x) =>
																x.id === u.id
																	? { ...x, email: e.target.value }
																	: x
															)
														)
													}
													onBlur={(e) => {
														const val = (e.target.value || "")
															.trim()
															.toLowerCase();
														if (val === (u._orig_email || "")) return;
														updateUser(u.id, { email: val });
													}}
													disabled={rowBusy}
													className="w-full border border-slate-200 rounded-md px-2 py-1 text-xs bg-white disabled:opacity-60"
												/>
											</td>

											<td className="px-4 py-3">
												<select
													value={(u.role || "").toLowerCase()}
													onChange={(e) => {
														const nextRole = e.target.value;

														const patch = { role: nextRole };

														// If switching away from bookkeeper, clear manager assignment
														if (
															String(nextRole).toLowerCase() !== "bookkeeper"
														) {
															patch.manager_id = null;
														}

														updateUser(u.id, patch);
													}}
													disabled={rowBusy}
													className="border border-slate-200 rounded-md px-2 py-1 text-xs bg-white disabled:opacity-60"
												>
													{ROLE_OPTIONS.map((r) => (
														<option key={r.value} value={r.value}>
															{r.label}
														</option>
													))}
												</select>
											</td>
											<td className="px-4 py-3">
												{(u.role || "").toLowerCase() === "bookkeeper" ? (
													<select
														value={u.manager_id ?? ""}
														onChange={(e) =>
															updateUser(u.id, {
																manager_id: e.target.value
																	? Number(e.target.value)
																	: null,
															})
														}
														disabled={rowBusy}
														className="border border-slate-200 rounded-md px-2 py-1 text-xs bg-white disabled:opacity-60"
													>
														<option value="">- None -</option>
														{managers.map((m) => (
															<option key={m.id} value={m.id}>
																{m.name || m.email}
															</option>
														))}
													</select>
												) : (
													<span className="text-[11px] text-slate-400">-</span>
												)}
											</td>
											<td className="px-4 py-3">
												<span
													className={
														"inline-flex items-center px-2 py-1 rounded-full text-[11px] border " +
														(u.is_active
															? "bg-emerald-50 text-emerald-700 border-emerald-100"
															: "bg-slate-50 text-slate-600 border-slate-200")
													}
												>
													{u.is_active ? "Active" : "Inactive"}
												</span>
											</td>

											<td className="px-4 py-3 text-right space-x-2">
												<button
													type="button"
													onClick={() => toggleActive(u)}
													disabled={rowBusy}
													className="text-[11px] text-slate-700 hover:underline disabled:opacity-60"
												>
													{u.is_active ? "Deactivate" : "Reactivate"}
												</button>

												<button
													type="button"
													onClick={() => handleOpenReset(u)}
													disabled={rowBusy}
													className="text-[11px] text-yecny-primary hover:underline disabled:opacity-60"
												>
													Reset password
												</button>

												{rowBusy && (
													<span className="text-[11px] text-slate-400">
														Saving...
													</span>
												)}
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				)}
			</section>
			{/* Reset password modal */}
			{resetOpen && resetUser && (
				<div className="fixed inset-0 z-50 flex items-center justify-center">
					<div
						className="absolute inset-0 bg-black/30"
						onClick={() => setResetOpen(false)}
						aria-hidden="true"
					/>
					<div className="relative w-full max-w-md bg-white rounded-xl shadow-2xl border border-slate-200 p-4">
						<div className="flex items-start justify-between gap-3">
							<div>
								<div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
									Reset password
								</div>
								<div className="text-sm font-semibold text-yecny-charcoal mt-1">
									{resetUser.name}{" "}
									<span className="text-slate-500">({resetUser.email})</span>
								</div>
							</div>
							<button
								type="button"
								onClick={() => setResetOpen(false)}
								className="text-xs text-slate-400 hover:text-slate-600"
							>
								X
							</button>
						</div>

						<div className="mt-4 space-y-2">
							<div className="text-xs text-slate-600">
								Leave blank to generate a temporary password automatically.
							</div>
							<input
								type="text"
								value={resetPassword}
								onChange={(e) => setResetPassword(e.target.value)}
								placeholder="Optional: enter a new password"
								className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-yecny-primary-soft focus:border-yecny-primary"
							/>

							<button
								type="button"
								onClick={handleDoReset}
								disabled={resettingId === resetUser.id}
								className="w-full mt-2 px-4 py-2 rounded-md bg-yecny-primary text-white text-xs hover:bg-yecny-primary-dark disabled:opacity-60"
							>
								{resettingId === resetUser.id
									? "Resetting..."
									: "Reset password"}
							</button>

							{resetResult && (
								<div className="mt-3 rounded-md border border-emerald-100 bg-emerald-50 p-3">
									<div className="text-[11px] uppercase tracking-[0.14em] text-emerald-700">
										Temporary password
									</div>
									<div className="mt-1 font-mono text-sm text-emerald-900 break-all">
										{resetResult}
									</div>
									<div className="mt-2 flex justify-end">
										<button
											type="button"
											onClick={() => copyToClipboard(resetResult)}
											className="text-[11px] text-emerald-800 hover:underline"
										>
											Copy
										</button>
									</div>
								</div>
							)}
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
