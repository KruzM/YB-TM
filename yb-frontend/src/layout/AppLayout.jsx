import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const navItems = [
  { to: "/", label: "Dashboard" },
  { to: "/tasks", label: "Tasks" },
  { to: "/clients", label: "Clients" },
  { to: "/settings", label: "Settings" },
];

export default function AppLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen flex bg-yecny-bg">
      {/* Sidebar */}
      <aside className="w-64 bg-yecny-primary-dark text-white flex flex-col shadow-lg">
        <div className="px-6 py-5 border-b border-black/20">
          <div className="text-2xl font-bold tracking-wide leading-none">
            YECNY
          </div>
          <div className="text-xs opacity-80 tracking-[0.25em] mt-1 uppercase">
            BOOKKEEPING
          </div>
        </div>

        <nav className="flex-1 px-2 py-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                [
                  "block px-4 py-2 rounded-md text-sm transition-all",
                  isActive
                    ? "bg-white text-yecny-primary font-medium shadow-sm"
                    : "text-yecny-primary-soft hover:bg-yecny-primary-soft/20",
                ].join(" ")
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <header className="flex items-center justify-between px-6 py-3 bg-white shadow-sm border-b border-slate-200">
          <div className="text-yecny-primary text-lg font-medium tracking-wide">
            Yecny Internal OS
          </div>

          <div className="flex items-center gap-3">
            {user && (
              <span className="px-3 py-1 bg-yecny-primary-soft text-yecny-primary-dark rounded-full text-sm">
                {user.name} <span className="text-yecny-slate">({user.role})</span>
              </span>
            )}
            <button
              onClick={logout}
              className="px-3 py-1 text-sm bg-yecny-primary-dark text-white rounded-md hover:bg-yecny-primary"
            >
              Logout
            </button>
          </div>
        </header>

        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
