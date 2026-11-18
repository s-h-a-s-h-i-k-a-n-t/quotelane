import Link from "next/link";
import { QuoteLayout } from "../quote-layout";

export default function ThankYouPage() {
  return (
    <QuoteLayout>
      <h1>Thank you for your request</h1>
      <p className="quote-intro">Your auto insurance quote request has been received.</p>
      <Link href="/" prefetch={false} className="quote-button quote-return">Back to home</Link>
    </QuoteLayout>
  );
}
