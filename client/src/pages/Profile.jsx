// Profile.jsx — role-based router.
// Admin → AdminProfile, Farmer → FarmerProfile.
// Forwards `embedded` + `onBack` so it works both standalone and inside Settings.
import { useUser } from "../hooks/useUser";
import AdminProfile from "./AdminProfile";
import FarmerProfile from "./FarmerProfile";

export default function Profile({ embedded = false, onBack }) {
  const { role } = useUser();
  return role === "Farmer"
    ? <FarmerProfile embedded={embedded} onBack={onBack} />
    : <AdminProfile embedded={embedded} onBack={onBack} />;
}
