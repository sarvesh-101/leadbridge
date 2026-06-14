import Link from "next/link";
import { Zap, ArrowLeft } from "lucide-react";

export default function TermsOfServicePage() {
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
              <h1 className="text-2xl font-bold text-white">Terms of Service</h1>
              <p className="text-gray-500 text-sm">Last updated: June 13, 2026</p>
            </div>
          </div>
        </div>

        <div className="space-y-8 text-gray-300 leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">1. Acceptance of Terms</h2>
            <p>
              By accessing or using LeadFlow AI ("the Platform"), you agree to be bound by these Terms of Service.
              If you do not agree to all the terms, you may not access or use the Platform.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">2. Description of Service</h2>
            <p>
              LeadFlow AI provides an AI-powered lead management, appointment booking, customer follow-up,
              and conversion management platform for businesses. The Platform includes features such as
              automated calling, WhatsApp messaging, lead scoring, booking management, and analytics.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">3. User Accounts</h2>
            <p className="mb-3">
              You are responsible for maintaining the confidentiality of your account credentials and
              for all activities that occur under your account. You must notify us immediately of any
              unauthorized use of your account.
            </p>
            <p>
              You must be at least 18 years of age to use the Platform. By creating an account, you
              represent that you meet this requirement.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">4. Subscription and Billing</h2>
            <p className="mb-3">
              The Platform is offered on a subscription basis. Paid plans are billed monthly or annually
              as selected during signup. All fees are non-refundable except as required by applicable law.
            </p>
            <p>
              We reserve the right to change our pricing with 30 days&apos; notice. Price changes will not
              affect your current billing cycle.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">5. Data Privacy</h2>
            <p className="mb-3">
              Your use of the Platform is subject to our{" "}
              <Link href="/legal/privacy" className="text-leadflow-accent hover:underline">Privacy Policy</Link>.
              We process lead data, call recordings, and WhatsApp messages as described in our Privacy Policy.
            </p>
            <p>
              You retain all rights to your data. We will not share your data with third parties except
              as necessary to provide the Service (e.g., AI processing, cloud storage) or as required by law.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">6. Acceptable Use</h2>
            <p className="mb-3">You agree not to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Use the Platform for any unlawful purpose or in violation of any applicable law</li>
              <li>Send spam, unsolicited messages, or harass any individuals through the Platform</li>
              <li>Attempt to gain unauthorized access to any part of the Platform</li>
              <li>Use the Platform to process sensitive personal data (health, financial, biometric)</li>
              <li>Reverse engineer, decompile, or disassemble any part of the Platform</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">7. AI Calling Compliance</h2>
            <p className="mb-3">
              When using the AI calling features, you represent and warrant that:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>You have obtained all necessary consents from leads before initiating AI calls</li>
              <li>Your use complies with applicable telemarketing and consumer protection laws</li>
              <li>You will maintain records of consent as required by law</li>
              <li>The AI will identify itself as an AI-powered system during calls</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">8. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, LeadFlow AI shall not be liable for any indirect,
              incidental, special, consequential, or punitive damages arising out of or relating to your
              use of the Platform. Our total liability shall not exceed the amount paid by you in the
              12 months preceding the claim.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">9. Termination</h2>
            <p>
              We reserve the right to suspend or terminate your account for violation of these Terms.
              You may terminate your account at any time. Upon termination, your data will be deleted
              within 30 days unless required otherwise by law.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">10. Changes to Terms</h2>
            <p>
              We may modify these Terms at any time. We will notify you of material changes via email
              or through the Platform. Continued use after changes constitutes acceptance of the new Terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">11. Contact</h2>
            <p>
              For questions about these Terms, please contact us at{" "}
              <a href="mailto:support@leadbridge.com" className="text-leadflow-accent hover:underline">
                support@leadbridge.com
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
