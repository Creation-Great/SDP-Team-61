import { Link, useNavigate } from "react-router-dom";

export default function Navbar() {
  const navigate = useNavigate();
  const role = localStorage.getItem("role");
  const loggedIn = !!localStorage.getItem("token");

  function handleLogout() {
    localStorage.clear();
    navigate("/login");
  }

  return (
    <nav style={{ padding: "10px", background: "#eee" }}>
      <Link to="/" style={{ marginRight: "10px" }}>Home</Link>

      {role === "student" && (
        <Link to="/submit-review" style={{ marginRight: "10px" }}>Submit Review</Link>
      )}

      {role === "instructor" && (
        <Link to="/instructor" style={{ marginRight: "10px" }}>Dashboard</Link>
      )}

      {!loggedIn && <Link to="/login">Login</Link>}
      {loggedIn && <button onClick={handleLogout}>Logout</button>}
    </nav>
  );
}
