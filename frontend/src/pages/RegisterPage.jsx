import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import API from "../services/api";
import "../styles/AuthForm.css";

export default function RegisterPage() {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Student");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");

  const handleRegister = async (e) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    try {
      await API.post("/auth/register", {
        name,
        email,
        password,
        role,
      });

      navigate("/login?registered=true");
    } catch (err) {
      setError("Server error");
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <h2>Create Account</h2>

        <form onSubmit={handleRegister}>
          <div className="input-group">
            <input
              type="text"
              placeholder="Name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="input-group">
            <input
              type="email"
              placeholder="Email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="input-group password-container">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <button
              type="button"
              className="show-hide-btn"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>

          <div className="input-group password-container">
            <input
              type={showConfirmPassword ? "text" : "password"}
              placeholder="Confirm Password"
              required
              value={confirmPassword}
              onChange={(e) =>
                setConfirmPassword(e.target.value)
              }
            />

            <button
              type="button"
              className="show-hide-btn"
              onClick={() =>
                setShowConfirmPassword(!showConfirmPassword)
              }
            >
              {showConfirmPassword ? "Hide" : "Show"}
            </button>
          </div>

          <div className="input-group">
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option>Student</option>
              <option>Instructor</option>
            </select>
          </div>

          {error && <p className="error-text">{error}</p>}

          <button type="submit" className="auth-btn">
            Register
          </button>
        </form>

        <p className="auth-switch">
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </div>
    </div>
  );
}
