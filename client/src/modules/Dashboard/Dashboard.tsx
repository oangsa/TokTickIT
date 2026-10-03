import { useAuth } from "../../auth/AuthProvider.js";
import RequesterDashboard from "./RequesterDashboard.js";
import StaffDashboard from "./StaffDashboard.js";
export default function Dashboard() {
  const { user } = useAuth();
  return user?.role === "REQUESTER" ? <RequesterDashboard /> : <StaffDashboard />;
}
