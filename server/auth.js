import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3001;

app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

app.post('/api/exchange-token', async (req, res) => {
  const { code } = req.body;

  if (!code) {
    return res.status(400).json({ error: 'Missing code parameter' });
  }

  if (!process.env.GITHUB_CLIENT_SECRET) {
    return res.status(500).json({ 
      error: 'GITHUB_CLIENT_SECRET not configured in .env' 
    });
  }

  try {
    const response = await fetch(
      'https://github.com/login/oauth/access_token',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          client_id: process.env.VITE_GITHUB_CLIENT_ID,
          client_secret: process.env.GITHUB_CLIENT_SECRET,
          code,
          redirect_uri: process.env.VITE_REDIRECT_URI
        })
      }
    );

    const data = await response.json();

    if (data.error) {
      console.error('GitHub OAuth error:', data.error_description);
      return res.status(400).json({ 
        error: data.error,
        description: data.error_description 
      });
    }

    if (!data.access_token) {
      return res.status(400).json({ 
        error: 'No access token returned from GitHub' 
      });
    }

    return res.json({ access_token: data.access_token });

  } catch (err) {
    console.error('Token exchange failed:', err);
    return res.status(500).json({ error: 'Token exchange failed' });
  }
});

app.listen(PORT, () => {
  console.log(`GitTrace auth server running on http://localhost:${PORT}`);
});
