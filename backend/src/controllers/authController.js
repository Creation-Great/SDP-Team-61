export const loginUser = (req, res) => {
    const { email, password } = req.body;
  
    if (email === "test@example.com" && password === "password123") {
      return res.json({
        token: "mock-token-123",
        user: { email },
      });
    }
  
    return res.status(401).json({ message: "Invalid credentials" });
  };
