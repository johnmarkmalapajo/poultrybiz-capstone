import { Navigate } from "react-router-dom";
import { useUser } from "../hooks/useUser";

export default function ProtectedRoute({ allow, redirectTo = "/dashboard", children }) {
  const { role } = useUser();
  const token = localStorage.getItem("token");

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (allow && !allow.includes(role)) {
    return <Navigate to={redirectTo} replace />;
  }

  return children;
}