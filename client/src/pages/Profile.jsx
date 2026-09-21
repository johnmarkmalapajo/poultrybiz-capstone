import { useUser } from "../hooks/useUser";
import AdminProfile from "./AdminProfile";
import FarmerProfile from "./FarmerProfile";

export default function Profile({ embedded = false, onBack }) {
  const { role } = useUser();
  return role === "Farmer"
    ? <FarmerProfile embedded={embedded} onBack={onBack} />
    : <AdminProfile embedded={embedded} onBack={onBack} />;
}