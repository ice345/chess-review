import Link from "next/link";
import { AppHeader } from "../components/app-header";
export default function NotFound() {
  return <main className="page-scroll utility-page"><AppHeader /><section className="utility-empty"><h1>Page not found</h1><p>Return to your saved games or import a new one.</p><Link href="/history">Open history</Link><Link href="/">Return home</Link></section></main>;
}
