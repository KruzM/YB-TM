import { NavLink, Outlet } from "react-router-dom";

const adminNav = [
	{ to: "/admin", label: "Organization" },
	{ to: "/admin/users", label: "Users" },
	{ to: "/admin/onboarding-templates", label: "Onboarding Templates" },
	{ to: "/admin/audit", label: "Audit Log" },
];

export default function AdminLayout() {
	return (
		<div className="space-y-5">
			<div>
				<div className="text-[11px] uppercase tracking-[0.18em] text-yecny-slate">
					Admin Portal
				</div>
				<h1 className="text-lg font-semibold text-yecny-charcoal">
					System settings & management
				</h1>
				<div className="text-sm text-slate-500 mt-1">
					Admin/Owner only. Manage your organization, users, and system
					settings.
				</div>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-[240px,1fr] gap-4">
				<aside className="rounded-xl border border-slate-200 bg-white/70 p-3">
					<div className="text-[11px] uppercase tracking-[0.18em] text-yecny-slate mb-2">
						Admin
					</div>

					<nav className="space-y-1">
						{adminNav.map((item) => (
							<NavLink
								key={item.to}
								to={item.to}
								end={item.to === "/admin"}
								className={({ isActive }) =>
									[
										"block px-3 py-2 rounded-md text-sm transition-all",
										isActive
											? "bg-yecny-primary text-white shadow-sm"
											: "text-slate-700 hover:bg-slate-50",
									].join(" ")
								}
							>
								{item.label}
							</NavLink>
						))}
					</nav>
				</aside>

				<section className="rounded-xl border border-slate-200 bg-white/80 p-4">
					<Outlet />
				</section>
			</div>
		</div>
	);
}
