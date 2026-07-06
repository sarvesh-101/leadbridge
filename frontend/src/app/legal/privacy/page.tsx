import Link from "next/link";
import { Zap, ArrowLeft } from "lucide-react";

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-[#0a0a1a]">
      <div className="max-w-3xl mx-auto px-4 py-16">
        {/* Header */}
        <div className="mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-gray-400 hover:text-gray-300 mb-6">
            <ArrowLeft className="w-4 h-4" /> Back to home
          </Link>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-leadflow-500 to-leadflow-accent flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Privacy Policy</h1>
              <p className="text-gray-500 text-sm">Last updated: June 13, 2026</p>
            </div>
          </div>
        </div>

        <div className="space-y-8 text-gray-300 leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">1. Information We Collect</h2>
            <p className="mb-3">We collect information to provide and improve our services:</p>
            <h3 className="text-white font-medium mb-2">Account Information</h3>
            <p className="mb-3">
              When you create an account, we collect your name, email address, phone number, business name,
              and billing information.
            </p>
            <h3 className="text-white font-medium mb-2">Lead Data</h3>
            <p className="mb-3">
              We process lead data that you import or collect through the Platform, including names, phone
              numbers, email addresses, property preferences, and interaction history.
            </p>
            <h3 className="text-white font-medium mb-2">Call Recordings & Transcripts</h3>
            <p className="mb-3">
              AI calls made through the Platform are recorded and transcribed for quality assurance,
              training, and lead management purposes.
            </p>
            <h3 className="text-white font-medium mb-2">Usage Data</h3>
            <p>
              We collect information about how you use the Platform, including features accessed,
              time spent, and interactions with the AI system.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">2. How We Use Your Information</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>To provide, maintain, and improve the Platform</li>
              <li>To process AI calls, generate transcripts, and schedule appointments</li>
              <li>To send notifications about leads, bookings, and follow-ups</li>
              <li>To process payments and manage subscriptions</li>
              <li>To send service-related communications</li>
              <li>To detect and prevent fraud or abuse</li>
              <li>To comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">3. Data Sharing & Third Parties</h2>
            <p className="mb-3">We may share your data with the following third-party service providers:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>AI Processing:</strong> DeepSeek (API) for call summarization and qualification extraction</li>
              <li><strong>Voice/AI:</strong> Omnidimension AI agents for voice calls</li>
              <li><strong>Telephony:</strong> Omnidimension for making and receiving phone calls</li>
              <li><strong>Messaging:</strong> WhatsApp Cloud API for sending messages</li>
              <li><strong>Payments:</strong> Razorpay for subscription billing</li>
              <li><strong>Storage:</strong> Supabase for storing call recordings and files</li>
              <li><strong>Email:</strong> SMTP (Nodemailer) for transactional emails (password reset, notifications, campaigns)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">4. Data Retention</h2>
            <p className="mb-3">
              We retain your data for as long as your account is active or as needed to provide the Service.
              Upon account cancellation, we retain your data for 30 days before permanent deletion, unless
              retention is required by law.
            </p>
            <p>
              Call recordings are retained for 90 days unless you choose to download or export them.
              Transcripts and extracted data are retained for the duration of your account.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">5. Data Security</h2>
            <p className="mb-3">
              We implement industry-standard security measures to protect your data:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Encryption in transit (TLS 1.3) for all API and web traffic</li>
              <li>Encryption at rest for stored data</li>
              <li>JWT-based authentication with automatic token expiry</li>
              <li>Rate limiting and brute-force protection on auth endpoints</li>
              <li>Regular security audits and dependency updates</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">6. Your Rights</h2>
            <p className="mb-3">You have the right to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Access your personal data held by us</li>
              <li>Correct inaccurate or incomplete data</li>
              <li>Delete your account and associated data</li>
              <li>Export your data in a portable format</li>
              <li>Object to processing of your data</li>
              <li>Withdraw consent at any time (where processing is based on consent)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">7. Cookies</h2>
            <p>
              We use essential cookies for authentication and session management. We do not use tracking
              cookies or third-party analytics cookies. Local storage is used to persist your session token.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">8. International Data Transfers</h2>
            <p>
              Your data may be processed in data centers located in India and the United States. By using
              the Platform, you consent to such transfers. We ensure appropriate safeguards are in place
              for international data transfers.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">9. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of material changes
              via email or through the Platform. Your continued use after changes constitutes acceptance
              of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">10. Contact</h2>
            <p>
              For privacy-related inquiries, please contact us at{" "}
              <a href="mailto:privacy@leadbridge.com" className="text-leadflow-accent hover:underline">
                privacy@leadbridge.com
              </a>.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-white/10 text-center">
          <Link href="/" className="text-gray-400 hover:text-gray-300 text-sm">
            &copy; {new Date().getFullYear()} LeadFlow AI. All rights reserved.
          </Link>
        </div>
      </div>
    </div>
  );
}
