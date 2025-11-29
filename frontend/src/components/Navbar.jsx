import { Link, useNavigate } from "react-router-dom";
import "./Navbar.css";

export default function Navbar() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  return (
    <div className="navbar">
      <div className="navbar-left">AI Peer Review</div>

      <div className="navbar-center">
        <Link to="/home">Home</Link>
        <Link to="/upload">Upload Assignment</Link>
        <Link to="/reviews">Assigned Reviews</Link>
      </div>

      <div className="navbar-right">
        <button onClick={handleLogout}>Logout</button>
      </div>
    </div>
  );
}
