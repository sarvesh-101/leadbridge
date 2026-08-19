"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { Menu, X, ArrowRight, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

import HeroSection from "@/components/marketing/HeroSection";
import MarqueeTicker from "@/components/marketing/MarqueeTicker";
import ProblemSection from "@/components/marketing/ProblemSection";
import HowItWorksSection from "@/components/marketing/HowItWorksSection";
import ResultsSection from "@/components/marketing/ResultsSection";
import TerritoryMap from "@/components/marketing/TerritoryMap";
import PricingSection from "@/components/marketing/PricingSection";
import CTASection from "@/components/marketing/CTASection";
import FeatureShowcase from "@/components/marketing/FeatureShowcase";
import TestimonialsSection from "@/components/marketing/TestimonialsSection";
import ComparisonSection from "@/components/marketing/ComparisonSection";
import IntegrationSection from "@/components/marketing/IntegrationSection";
import ROISection from "@/components/marketing/ROISection";
import FAQSection from "@/components/marketing/FAQSection";

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Results", href: "#results" },
  { label: "Compare", href: "#comparison" },
  { label: "Territories", href: "#territories" },
  { label: "Pricing", href: "#pricing" },
];

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[#0A0F0C] text-[#F0F7F3] relative overflow-x-clip">
      {/* Navigation */}
      <nav
        className={cn(
          "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
          scrolled
            ? "bg-[#0A0F0C]/75 backdrop-blur-xl border-b border-white/[0.08]"
            : "bg-transparent"
        )}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 lg:h-20">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#34D399] to-[#1B4332] flex items-center justify-center shadow-[0_0_20px_rgba(52,211,153,0.35)]">
                <Zap className="w-4 h-4 text-[#0A0F0C]" />
              </div>
              <span className="text-[18px] font-display font-bold text-[#F0F7F3] tracking-[-0.02em]">
                LeadBridge
              </span>
              <span className="w-2 h-2 rounded-full bg-[#34D399] animate-pulse shadow-[0_0_8px_#34D399]" />
            </Link>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-8">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-[13px] text-[#9FB0A6] hover:text-[#F0F7F3] transition-colors font-medium tracking-[0.02em]"
                >
                  {link.label}
                </Link>
              ))}
            </div>

            <div className="hidden md:flex items-center gap-4">
              <Link
                href="/auth/login"
                className="text-[13px] text-[#9FB0A6] hover:text-[#F0F7F3] transition-colors font-medium"
              >
                Sign In
              </Link>
              <Link
                href="/auth/register"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-[#34D399] to-[#2D6A4F] text-[#0A0F0C] text-[13px] font-bold transition-all duration-150 hover:scale-[1.02] hover:shadow-[0_0_32px_rgba(52,211,153,0.5)] active:scale-[0.98]"
              >
                Request Your City
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <button
              className="md:hidden text-[#F0F7F3]"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden bg-[#0A0F0C]/95 backdrop-blur-xl border-b border-white/[0.08]"
            >
              <div className="px-4 py-4 space-y-3">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="block text-[13px] text-[#9FB0A6] hover:text-[#F0F7F3] py-2"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {link.label}
                  </Link>
                ))}
                <div className="pt-3 space-y-3">
                  <Link
                    href="/auth/login"
                    className="block text-center text-[13px] text-[#9FB0A6] hover:text-[#F0F7F3] py-2"
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/auth/register"
                    className="block text-center px-5 py-3 rounded-lg bg-gradient-to-r from-[#34D399] to-[#2D6A4F] text-[#0A0F0C] text-[13px] font-bold"
                  >
                    Request Your City
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Hero */}
      <HeroSection />

      {/* Live Demo Ticker */}
      <section id="demo">
        <MarqueeTicker />
      </section>

      {/* Problem Section */}
      <ProblemSection />

      {/* Features */}
      <FeatureShowcase />

      {/* How It Works */}
      <section id="how-it-works">
        <HowItWorksSection />
      </section>

      {/* Results */}
      <section id="results">
        <ResultsSection />
      </section>

      {/* Testimonials */}
      <TestimonialsSection />

      {/* ROI Comparison */}
      <ROISection />

      {/* Comparison Table */}
      <ComparisonSection />

      {/* Integrations */}
      <IntegrationSection />

      {/* Territory Map */}
      <section id="territories">
        <TerritoryMap />
      </section>

      {/* FAQ */}
      <FAQSection />

      {/* Pricing */}
      <section id="pricing">
        <PricingSection />
      </section>

      {/* Final CTA */}
      <CTASection />

      {/* Footer */}
      <footer className="relative z-10 py-12 border-t border-white/[0.08] bg-[#080C0A]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#34D399] to-[#1B4332] flex items-center justify-center">
                  <Zap className="w-4 h-4 text-[#0A0F0C]" />
                </div>
                <span className="text-[18px] font-display font-bold text-[#F0F7F3]">
                  LeadBridge
                </span>
              </div>
              <p className="text-[13px] text-[#9FB0A6]">
                One broker per city. AI calls every lead in 60 seconds.
              </p>
            </div>
            {[
              {
                title: "Product",
                links: [
                  { label: "Features", href: "#features" },
                  { label: "Pricing", href: "#pricing" },
                  { label: "Territories", href: "#territories" },
                  { label: "How It Works", href: "#how-it-works" },
                ],
              },
              {
                title: "Company",
                links: [
                  { label: "Sign In", href: "/auth/login" },
                  { label: "Register", href: "/auth/register" },
                  { label: "Contact", href: "mailto:support@converza.tech" },
                ],
              },
              {
                title: "Legal",
                links: [
                  { label: "Privacy", href: "/legal/privacy" },
                  { label: "Terms", href: "/legal/terms" },
                ],
              },
            ].map((col) => (
              <div key={col.title}>
                <h4 className="caption mb-4">{col.title}</h4>
                <ul className="space-y-2">
                  {col.links.map((link: { label: string; href: string }) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="text-[13px] text-[#9FB0A6] hover:text-[#F0F7F3] transition-colors"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="pt-8 border-t border-white/[0.08] text-center text-[13px] text-[#6B7C73]">
            © {new Date().getFullYear()} LeadBridge. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
