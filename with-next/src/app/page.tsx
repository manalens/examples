import { DemoActions } from '../components/demo-actions';

export default function Home() {
  return (
    <>
      <h1>Home</h1>
      <p>Each link in the menu is a client-side navigation. Each one sends a page view.</p>
      <DemoActions />
    </>
  );
}
