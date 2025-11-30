import app from "./app.js";
import reviewRoutes from "./routes/reviewRoutes.js";

const PORT = 8000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
app.use("/api/reviews", reviewRoutes);