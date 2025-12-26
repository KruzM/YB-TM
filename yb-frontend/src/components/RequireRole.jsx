import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function RequireRole({ roles = [], children }) {
	const { user } = useAuth();
	const role = (user?.role || "").toLowerCase();
	const allowed = roles.map((r) => String(r).toLowerCase());

	if (!user) return <Navigate to="/login" replace />;
	if (allowed.length > 0 && !allowed.includes(role))
		return <Navigate to="/" replace />;

	return children;
}
