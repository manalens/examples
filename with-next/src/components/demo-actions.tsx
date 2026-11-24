'use client';

import { useState } from 'react';
import { getAnalytics } from '../lib/analytics';

/** Buttons for identify(), a custom event and reset(). */
export function DemoActions() {
  const [status, setStatus] = useState('');

  async function signIn() {
    // Call identify() after your login. Use your own stable user ID.
    await getAnalytics()?.identify('demo_user_42', { plan: 'free' });
    setStatus('identify: demo_user_42');
  }

  function startTrial() {
    // A custom event: a completed action, with flat properties.
    getAnalytics()?.track('trial_started', { plan: 'pro', source: 'next_example' });
    setStatus('track: trial_started');
  }

  function signOut() {
    // On logout: clear the user ID, the anonymous ID and the session.
    getAnalytics()?.reset();
    setStatus('reset');
  }

  return (
    <div className="actions">
      <button type="button" onClick={signIn}>Sign in (identify)</button>
      <button type="button" onClick={startTrial}>Start trial (custom event)</button>
      <button type="button" onClick={signOut}>Sign out (reset)</button>
      <p className="status" role="status">{status}</p>
    </div>
  );
}
