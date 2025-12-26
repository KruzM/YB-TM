import { useEffect, useMemo, useState } from "react";
import api from "../../api/client";

const DEFAULT_FLAGS = {
	purge_enabled: true,
	client_portal_enabled: false,
};

export default function AdminOrg() {
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");
	const [savedMsg, setSavedMsg] = useState("");

	const [orgName, setOrgName] = useState("");
	const [docsRootPath, setDocsRootPath] = useState("");
	const [flags, setFlags] = useState(DEFAULT_FLAGS);

	const flagsPretty = useMemo(() => JSON.stringify(flags, null, 2), [flags]);

	useEffect(() => {
		const load = async () => {
			setLoading(true);
			setError("");
			setSavedMsg("");
			try {
				const res = await api.get("/admin/settings");
				const rows = res.data || [];
				const map = {};
				rows.forEach((r) => (map[r.key] = r.value));

				setOrgName(typeof map.org_name === "string" ? map.org_name : "");
				setDocsRootPath(
					typeof map.docs_root_path === "string" ? map.docs_root_path : ""
				);
				setFlags(
					map.feature_flags && typeof map.feature_flags === "object"
						? { ...DEFAULT_FLAGS, ...map.feature_flags }
						: DEFAULT_FLAGS
				);
			} catch (e) {
				console.error(e);
				setError("Failed to load admin settings.");
			} finally {
				setLoading(false);
			}
		};
		load();
	}, []);

	const handleSave = async () => {
		setSaving(true);
		setError("");
		setSavedMsg("");
		try {
			await api.put("/admin/settings", {
				settings: {
					org_name: orgName.trim(),
					docs_root_path: docsRootPath.trim(),
					feature_flags: flags,
				},
			});
			setSavedMsg("Saved.");
			setTimeout(() => setSavedMsg(""), 1500);
		} catch (e) {
			console.error(e);
			setError("Failed to save settings.");
		} finally {
			setSaving(false);
		}
	};

	const toggleFlag = (key) => {
		setFlags((prev) => ({ ...prev, [key]: !prev[key] }));
	};

	return (
		<div className="space-y-4">
			<div className="text-[11px] uppercase tracking-[0.18em] text-yecny-slate">
				Organization
			</div>

			<div className="text-sm text-slate-700">
				This is your OS control panel (NAS-ready docs path, feature flags,
				etc.).
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

			<div className="rounded-xl border border-slate-200 bg-white/80 p-4 space-y-4">
				{loading ? (
					<div className="text-xs text-slate-400">Loading...</div>
				) : (
					<>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
							<div className="space-y-1">
								<div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
									Org name
								</div>
								<input
									value={orgName}
									onChange={(e) => setOrgName(e.target.value)}
									className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-yecny-primary-soft focus:border-yecny-primary"
									placeholder="Yecny Bookkeeping"
								/>
							</div>

							<div className="space-y-1">
								<div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
									Docs root path (NAS-ready)
								</div>
								<input
									value={docsRootPath}
									onChange={(e) => setDocsRootPath(e.target.value)}
									className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-yecny-primary-soft focus:border-yecny-primary"
									placeholder="/mnt/nas/yecny/docs"
								/>
								<div className="text-[11px] text-slate-500">
									Used by document uploads/downloads. Keep this absolute and
									mounted on the server.
								</div>
							</div>
						</div>
						<div className="pt-2 border-t border-slate-100">
							<div className="text-[11px] uppercase tracking-[0.14em] text-slate-500 mb-2">
								Feature flags
							</div>

							<div className="flex flex-wrap gap-2">
								<button
									type="button"
									onClick={() => toggleFlag("purge_enabled")}
									className={
										"px-3 py-1.5 rounded-md text-xs border " +
										(flags.purge_enabled
											? "bg-yecny-primary text-white border-yecny-primary"
											: "bg-white text-slate-700 border-slate-300 hover:bg-slate-50")
									}
								>
									Purge enabled: {flags.purge_enabled ? "On" : "Off"}
								</button>

								<button
									type="button"
									onClick={() => toggleFlag("client_portal_enabled")}
									className={
										"px-3 py-1.5 rounded-md text-xs border " +
										(flags.client_portal_enabled
											? "bg-yecny-primary text-white border-yecny-primary"
											: "bg-white text-slate-700 border-slate-300 hover:bg-slate-50")
									}
								>
									Client portal: {flags.client_portal_enabled ? "On" : "Off"}
								</button>
							</div>

							<div className="mt-3 text-[11px] text-slate-500">
								Stored as JSON:
							</div>
							<pre className="mt-1 text-[11px] bg-slate-50 border border-slate-200 rounded-md p-2 overflow-auto">
								{flagsPretty}
							</pre>
						</div>

						<div className="flex justify-end">
							<button
								type="button"
								onClick={handleSave}
								disabled={saving}
								className="px-4 py-2 rounded-md bg-yecny-primary text-white text-xs hover:bg-yecny-primary-dark disabled:opacity-60"
							>
								{saving ? "Saving..." : "Save"}
							</button>
						</div>
					</>
				)}
			</div>

			<div className="rounded-lg border border-slate-200 bg-white p-3 text-[12px] text-slate-600">
				Tip: With this in place, you can move the entire docs store to a NAS by
				changing one setting - no redeploy needed.
			</div>
		</div>
	);
}
