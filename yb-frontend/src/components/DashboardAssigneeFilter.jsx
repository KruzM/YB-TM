import { useEffect, useMemo, useState } from "react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function DashboardAssigneeFilter({ value, onChange }) {
	const { user } = useAuth();
	const role = (user?.role || "").toLowerCase();
	const isPrivileged = role === "admin" || role === "owner";
	const isManager = role === "manager";

	const [users, setUsers] = useState([]);
	const [loading, setLoading] = useState(true);

	const show = isPrivileged || isManager;

	useEffect(() => {
		if (!show) return;

		const load = async () => {
			setLoading(true);
			try {
				const res = await api.get("/users/team");
				setUsers(res.data || []);
			} catch (e) {
				console.error(e);
				setUsers([]);
			} finally {
				setLoading(false);
			}
		};

		load();
	}, [show]);

	const options = useMemo(() => {
		const opts = [];
		opts.push({ value: "me", label: "My Tasks" });

		for (const u of users) {
			if (u.id === user?.id) continue;
			opts.push({ value: String(u.id), label: u.name || u.email });
		}

		if (isPrivileged) {
			opts.push({ value: "unassigned", label: "Unassigned (assign queue)" });
		}
		return opts;
	}, [users, user?.id, isPrivileged]);

	if (!show) return null;

	return (
		<div className="flex items-center gap-2">
			<div className="text-sm text-yecny-slate">Viewing:</div>
			<select
				className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
				value={value}
				onChange={(e) => onChange(e.target.value)}
				disabled={loading}
			>
				{options.map((o) => (
					<option key={o.value} value={o.value}>
						{o.label}
					</option>
				))}
			</select>
		</div>
	);
}
