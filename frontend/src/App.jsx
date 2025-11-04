import { NavLink, Routes, Route, useNavigate } from "react-router-dom";
import LoginPage from "./LoginPage.jsx";
import StudentDashboard from "./StudentDashboard.jsx";
import FacultyDashboard from "./FacultyDashboard.jsx";
import SubmitDocument from "./SubmitDocument.jsx";
import { API_BASE_URL } from "./config.js";

function Header() {
  return (
    <header className="app-header">
      <div className="app-header-title">
        <span>Placeholder</span>F
      </div>
      <nav className="app-nav">
        <NavLink to="/" end className={({ isActive }) => (isActive ? "active-link" : "")}>
          Home
        </NavLink>
        <NavLink to="/student" className={({ isActive }) => (isActive ? "active-link" : "")}>
          Student
        </NavLink>
        <NavLink to="/faculty" className={({ isActive }) => (isActive ? "active-link" : "")}>
          Faculty
        </NavLink>
      </nav>
    </header>
  );
}

function Footer() {

}

function App() {
  const navigate = useNavigate();

  const handleLogout = () => {
    // hit backend logout, then go home
    fetch(`${API_BASE_URL}/logout`, {
      method: "GET",
      credentials: "include",
    }).finally(() => {
      navigate("/");
    });
  };

  return (
    <div className="app-shell">
      <Header />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<LoginPage />} />
          <Route path="/student" element={<StudentDashboard onLogout={handleLogout} />} />
          <Route path="/faculty" element={<FacultyDashboard onLogout={handleLogout} />} />
          <Route path="/submit" element={<SubmitDocument onLogout={handleLogout} />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}

export default App;
