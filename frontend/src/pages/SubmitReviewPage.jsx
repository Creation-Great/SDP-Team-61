import { useState } from 'react';
import api from '../services/api';

export default function SubmitReviewPage() {
  const [score, setScore] = useState(3);
  const [text, setText] = useState("");
  const [aiRewrite, setAiRewrite] = useState("");

  async function submitReview() {
    const token = "placeholder-token";

    const res = await api.post("/reviews/submit", {
      token,
      numeric_score: score,
      text
    });

    setAiRewrite(res.data.review.ai_rewrite);
  }

  return (
    <div>
      <h2>Submit Review</h2>

      <label>Score:</label>
      <input type="number" value={score} onChange={e => setScore(e.target.value)} />

      <textarea 
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Write constructive feedback"
      />

      <button onClick={submitReview}>Submit</button>

      {aiRewrite && (
        <>
          <h3>AI Suggested Rewrite:</h3>
          <p>{aiRewrite}</p>
        </>
      )}
    </div>
  );
}
