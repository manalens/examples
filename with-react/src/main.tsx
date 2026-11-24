// Harbor Lights: a small game website in React with React Router.
//
// - A page view on each navigation (<AnalyticsTracker>).
// - wishlist_clicked when the player clicks the Steam button.
// - identify() after the newsletter form succeeds, and reset() on sign out.
import { StrictMode, useState, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { AnalyticsTracker } from './analytics-tracker';
import { getAnalytics } from './analytics';

function Home() {
  return (
    <>
      <h1>Harbor Lights</h1>
      <p>A cozy lighthouse keeper game. Coming to Steam.</p>
      <button
        onClick={() => {
          // Track after the action, with flat snake_case names.
          getAnalytics()?.track('wishlist_clicked', { placement: 'home_hero' });
          window.open('https://store.steampowered.com/', '_blank', 'noopener');
        }}
      >
        Wishlist on Steam
      </button>
    </>
  );
}

function Devlog() {
  return (
    <>
      <h1>Devlog</h1>
      <p>Week 12: the fog machine works.</p>
    </>
  );
}

function Newsletter() {
  const [subscribed, setSubscribed] = useState(false);
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Your own signup call goes here. Identify only after it succeeds, with
    // your opaque player or account ID, never the email address.
    const playerId = `player_${crypto.randomUUID().slice(0, 8)}`;
    getAnalytics()?.identify(playerId);
    getAnalytics()?.track('newsletter_subscribed', { source: 'newsletter_page' });
    setSubscribed(true);
  }
  if (subscribed) {
    return (
      <>
        <p>Thanks for subscribing.</p>
        <button
          onClick={() => {
            // Sign out: forget the user ID and start a new anonymous ID.
            getAnalytics()?.reset();
            setSubscribed(false);
          }}
        >
          Sign out
        </button>
      </>
    );
  }
  return (
    <form onSubmit={onSubmit}>
      <input type="email" required placeholder="you@example.com" aria-label="Email" />
      <button type="submit">Subscribe</button>
    </form>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AnalyticsTracker />
      <nav>
        <Link to="/">Home</Link>
        <Link to="/devlog">Devlog</Link>
        <Link to="/newsletter">Newsletter</Link>
      </nav>
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/devlog" element={<Devlog />} />
          <Route path="/newsletter" element={<Newsletter />} />
        </Routes>
      </main>
    </BrowserRouter>
  </StrictMode>,
);
